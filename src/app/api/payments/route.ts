import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';

// Configuración de conexión
const config = {
   server: '207.244.236.74\\saint',
  user: 'sa',
  password: 'Rsistems86',
  database: 'lendfusion',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectionTimeout: 30000,
    requestTimeout: 30000
  }
};

export async function GET(request: NextRequest) {
  try {
    // Obtener parámetros de query
    const searchParams = request.nextUrl.searchParams;
    const bank = searchParams.get('bank');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Conectar a la base de datos
    const pool = await sql.connect(config);
    
    let query = `
      SELECT 
    t.date AS Fecha,
    t.id AS Numero,
    a.title AS Banco,
    t.amount AS Cantidad,
    t.reference AS Referencia,
    t.description AS Comentario,
    l.number AS NumeroPrestamo,
    p.name AS NombreCliente,
    pi.value AS CedulaRif
FROM export_account_transaction t
INNER JOIN export_account a ON t.account_id = a.id
LEFT JOIN export_loan_transaction_accounttransaction ltat ON t.id = ltat.accounttransaction_id
LEFT JOIN export_loan_transaction lt ON ltat.transaction_id = lt.id
LEFT JOIN export_loan l ON lt.loan_id = l.id 
LEFT JOIN export_loan_terms ltrms ON l.id = ltrms.loan_id AND ltrms.status = 'active'
LEFT JOIN export_loan_party lp ON ltrms.id = lp.terms_id AND lp.role = 'borrower'
LEFT JOIN export_party p ON lp.party_id = p.id
LEFT JOIN export_party_identifier pi ON p.id = pi.party_id 
    AND pi.status = 'active' 
-- Excluir préstamos que tienen transacciones de tipo 'writeoff'
WHERE l.id NOT IN (
    SELECT DISTINCT loan_id 
    FROM export_loan_transaction 
    WHERE type = 'writeoff'
)
-- Incluir también transacciones que no están vinculadas a ningún préstamo
OR l.id IS NULL



    `;
    
    // Aplicar filtros si existen
    const params: any[] = [];
    
    if (bank && bank !== '') {
      query += ` AND a.title LIKE '%' + @bank + '%'`;
      params.push({ name: 'bank', value: bank });
    }
    
    if (dateFrom) {
      query += ` AND t.date >= @dateFrom`;
      params.push({ name: 'dateFrom', value: new Date(dateFrom) });
    }
    
    if (dateTo) {
      query += ` AND t.date <= @dateTo`;
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      params.push({ name: 'dateTo', value: toDate });
    }
    
    query += ` ORDER BY t.date DESC`;
    
    const requestQuery = pool.request();
    
    // Agregar parámetros a la consulta
    params.forEach(param => {
      requestQuery.input(param.name, param.value);
    });
    
    const result = await requestQuery.query(query);
    
    // Calcular totales
    const totalCantidad = result.recordset.reduce((sum, row) => sum + row.Cantidad, 0);
    
    // Obtener lista de bancos únicos
    const bancos = [...new Set(result.recordset.map(row => row.Banco))].filter(Boolean).sort();
    
    // Cerrar la conexión
    await pool.close();
    
    return NextResponse.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length,
      totalCantidad: totalCantidad,
      bancos: bancos,
      filtros: {
        bank,
        dateFrom,
        dateTo
      }
    });
    
  } catch (error: any) {
    console.error('Error al obtener datos de pagos:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al conectar con la base de datos',
      details: error.toString()
    }, { status: 500 });
  }
}