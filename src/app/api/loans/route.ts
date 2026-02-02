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
        SELECT 
          l.id AS loan_id,
          l.number AS loan_number,
          p.name AS nombre_cliente,
          lt.principal AS monto_financiado,
          lt.interest_rate AS tasa_interes,
          (SELECT COALESCE(SUM(lsi.interest), 0) FROM export_loan_schedule_item lsi WHERE lsi.terms_id = lt.id) AS interes_total,
          ROUND(lt.principal + ((SELECT COALESCE(SUM(lsi.interest), 0) FROM export_loan_schedule_item lsi WHERE lsi.terms_id = lt.id)), 2) AS monto_total,
          (SELECT COUNT(*) FROM export_loan_schedule_item lsi WHERE lsi.terms_id = lt.id) AS total_cuotas,
          (SELECT COUNT(*) FROM export_loan_schedule_item lsi WHERE lsi.terms_id = lt.id AND lsi.payment_status = 'unpaid') AS cuotas_pendientes,
          (SELECT COUNT(*) FROM export_loan_schedule_item lsi WHERE lsi.terms_id = lt.id AND lsi.payment_status = 'paid') AS cuotas_pagadas,
          ISNULL(a.name, '') AS analista_asignada,
          CONVERT(varchar, l.created, 120) AS fecha_creacion,
          CONVERT(varchar, l.issued, 120) AS fecha_desembolso,
          l.currency AS moneda
        FROM export_loan l
        INNER JOIN export_loan_terms lt ON l.id = lt.loan_id AND lt.status = 'active'
        LEFT JOIN export_loan_party lp ON lt.id = lp.terms_id AND lp.role = 'borrower'
        LEFT JOIN export_party p ON lp.party_id = p.id
        LEFT JOIN export_loan_application la ON l.id = la.loan_id
        LEFT JOIN export_application ap ON la.application_id = ap.id
        LEFT JOIN export_admin a ON ap.analyst_manager_id = a.id
        WHERE l.status = 'issued' 
          AND l.state = 'normal'
        ORDER BY l.created DESC
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