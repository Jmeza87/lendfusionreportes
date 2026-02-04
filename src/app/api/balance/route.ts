import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';

export const maxDuration = 300; 
export const dynamic = 'force-dynamic';

const config = {
  server: '207.244.236.74\\saint',
  user: 'sa',
  password: 'Rsistems86',
  database: 'lendfusion',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectionTimeout: 30000, 
    requestTimeout: 300000     
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

// Función para esperar entre reintentos
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function GET(request: NextRequest) {
  let pool;
  const maxRetries = 10;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Intento de conexión ${attempt} de ${maxRetries}...`);
      
      pool = await sql.connect(config);
      
      const query = `

                             USE lendfusion;

                                        -- Crear función para extraer ciudad (si no existe)
                                        IF OBJECT_ID('dbo.ExtraerCiudad', 'FN') IS NOT NULL
                                            DROP FUNCTION dbo.ExtraerCiudad;
                                        GO

                                        CREATE FUNCTION dbo.ExtraerCiudad (@display_name NVARCHAR(MAX))
                                        RETURNS NVARCHAR(100)
                                        AS
                                        BEGIN
                                            DECLARE @ciudad NVARCHAR(100);

                                            IF @display_name IS NULL
                                                RETURN NULL;

                                            -- Eliminar espacios
                                            SET @display_name = LTRIM(RTRIM(@display_name));

                                            -- Encontrar la última coma (antes del código postal)
                                            DECLARE @ultima_coma INT = CHARINDEX(',', REVERSE(@display_name));
                                            
                                            IF @ultima_coma = 0
                                                RETURN @display_name;

                                            -- Posición de la última coma en la cadena original
                                            DECLARE @pos_ultima_coma INT = LEN(@display_name) - @ultima_coma + 1;

                                            -- Obtener la parte antes del código postal
                                            DECLARE @sin_codigo NVARCHAR(MAX) = LEFT(@display_name, @pos_ultima_coma - 1);

                                            -- Encontrar la última coma en la parte sin código (sería antes del estado si existe)
                                            DECLARE @penultima_coma INT = CHARINDEX(',', REVERSE(@sin_codigo));
                                            
                                            IF @penultima_coma = 0
                                                RETURN LTRIM(RTRIM(@sin_codigo));

                                            -- Posición de la penúltima coma en la cadena original
                                            DECLARE @pos_penultima_coma INT = LEN(@sin_codigo) - @penultima_coma + 1;

                                            -- Extraer lo que está entre la penúltima coma y la última coma (o entre el inicio y la penúltima coma)
                                            -- Esto normalmente sería la ciudad
                                            DECLARE @antes_de_penultima NVARCHAR(MAX) = LEFT(@display_name, @pos_penultima_coma - 1);
                                            
                                            -- Encontrar la coma anterior a la penúltima
                                            DECLARE @antepenultima_coma INT = CHARINDEX(',', REVERSE(@antes_de_penultima));
                                            
                                            IF @antepenultima_coma = 0
                                                RETURN LTRIM(RTRIM(@antes_de_penultima));

                                            -- Posición de la antepenúltima coma
                                            DECLARE @pos_antepenultima_coma INT = LEN(@antes_de_penultima) - @antepenultima_coma + 1;

                                            -- Extraer ciudad (entre la antepenúltima y penúltima coma)
                                            SET @ciudad = SUBSTRING(@display_name, @pos_antepenultima_coma + 1, 
                                                                @pos_penultima_coma - @pos_antepenultima_coma - 1);

                                            SET @ciudad = LTRIM(RTRIM(@ciudad));

                                            RETURN @ciudad;
                                        END
                                        GO

                                        -- Consulta principal con ciudad extraída
                                        SELECT 
                                            l.number AS [Numero de prestamo],
                                            p.name AS [Nombre del cliente],
                                            ISNULL(pi.value, 'No registrada') AS [Cedula/Rif],
                                            
                                            -- Ciudad extraída usando la función
                                            dbo.ExtraerCiudad(a.display_name) AS [Ciudad],
                                            
                                            -- También mostrar la dirección completa para referencia
                                            a.display_name AS [Direccion Completa],
                                            
                                            lt.principal AS [Monto financiado],
                                            lt.interest_rate AS [Tasa interes %],
                                            
                                            -- Información de cuotas
                                            (SELECT COUNT(*) FROM export_loan_schedule_item WHERE terms_id = lt.id) AS [Total cuotas],
                                            ROW_NUMBER() OVER (PARTITION BY lt.id ORDER BY lsi.duedate) AS [Numero de cuota],
                                            
                                            -- Montos de la cuota
                                            lsi.principal AS [Monto capital cuota],
                                            lsi.interest AS [Monto interes cuota],
                                            (lsi.principal + lsi.interest) AS [Cuota + interes],
                                            
                                            -- Estado de pago
                                            lsi.total_paid AS [Pagado],
                                            lsi.duedate AS [Fecha de vencimiento],
                                            
                                            -- Días hasta el vencimiento (solo si NO está pagado)
                                            CASE 
                                                WHEN lsi.payment_status = 'paid' THEN NULL
                                                ELSE DATEDIFF(DAY, GETDATE(), lsi.duedate)
                                            END AS [Dias para vencer],
                                            
                                            -- Estado de vencimiento (condicional)
                                            CASE 
                                                WHEN lsi.payment_status = 'paid' 
                                                    THEN 'PAGADO'
                                                WHEN DATEDIFF(DAY, GETDATE(), lsi.duedate) < 0 
                                                    THEN 'VENCIDO'
                                                ELSE 'PENDIENTE'
                                            END AS [Estado cuota],

                                            ap.dealership_salesperson_firstname + ' ' + ap.dealership_salesperson_lastname AS Vendedor,
                                            ad.name AS Analista

                                        FROM export_loan l
                                        INNER JOIN export_loan_terms lt ON l.id = lt.loan_id AND lt.status = 'active'
                                        INNER JOIN export_loan_schedule_item lsi ON lt.id = lsi.terms_id
                                        LEFT JOIN export_loan_party lp ON lt.id = lp.terms_id AND lp.role = 'borrower'
                                        LEFT JOIN export_party p ON lp.party_id = p.id
                                        LEFT JOIN export_party_identifier pi ON p.id = pi.party_id 
                                            AND pi.status = 'active' 
                                            AND pi.type IN ('personal_code', 'company_code')
                                        LEFT JOIN export_loan_application la ON l.id = la.loan_id
                                        LEFT JOIN export_application ap ON la.application_id = ap.id
                                        LEFT JOIN export_admin ad ON ad.id = ap.analyst_manager_id
                                        -- Obtener la dirección del cliente
                                        LEFT JOIN export_party_address pa ON p.id = pa.party_id AND pa.status = 'active'
                                        LEFT JOIN export_address a ON pa.address_id = a.id
                                        WHERE l.status = 'issued' 
                                            AND l.state = 'normal'
                                        ORDER BY p.name, l.number, lsi.duedate;



      `;
      
      const result = await pool.request().query(query);
      await pool.close();
      
      return NextResponse.json({
        success: true,
        data: result.recordset,
        total: result.recordset.length,
        attempts: attempt
      });

    } catch (error: any) {
      lastError = error;
      console.error(`Error en intento ${attempt}:`, error.message);
      
      if (pool) await pool.close();

      // Si no es el último intento, esperamos 2 segundos antes de volver a probar
      if (attempt < maxRetries) {
        await delay(2000); 
      }
    }
  }

  // Si llega aquí, es porque agotó los 3 intentos
  return NextResponse.json({
    success: false,
    error: 'Agotados los 3 intentos de conexión',
    details: lastError?.toString()
  }, { status: 503 });
}