'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Container, Row, Col, Card, Button, Form, Table, Dropdown, InputGroup, FormControl, Alert } from 'react-bootstrap'
import { 
  BiArrowBack, BiDownload, BiFilter, BiCalendar, BiPrinter,
  BiDollar, BiTrendingUp, BiSearch, BiRefresh, BiX, BiFile, BiTable, BiBuilding
} from 'react-icons/bi'
import Link from 'next/link'
import AuthGuard from '@/components/AuthGuard'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import html2canvas from 'html2canvas'

interface PaymentData {
  Fecha: string;
  Numero: number;
  Banco: string;
  Cantidad: number;
  Referencia: string;
  Comentario: string;
  NumeroPrestamo: string;
  NombreCliente: string;
  CedulaRif: string;
}

export default function ReportesConsolidacionPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paymentData, setPaymentData] = useState<PaymentData[]>([])
  const [filteredData, setFilteredData] = useState<PaymentData[]>([])
  
  // Estados para los filtros
  const [bankFilter, setBankFilter] = useState('')
  const [dateFromFilter, setDateFromFilter] = useState('')
  const [dateToFilter, setDateToFilter] = useState('')
  
  // Estado para totales
  const [totalCantidad, setTotalCantidad] = useState(0)

  // Ref para capturar la tabla para PDF
  const tableRef = useRef<HTMLDivElement>(null)

  // Cargar datos iniciales
  useEffect(() => {
    loadData()
  }, [])

  // Aplicar filtros cuando cambien
  useEffect(() => {
    applyFilters()
  }, [bankFilter, dateFromFilter, dateToFilter, paymentData])

  const loadData = async () => {
  try {
    setLoading(true)
    setError(null)
    
    const response = await fetch('/api/payments')
    
    // Verificar si la respuesta es HTML (error 404)
    const contentType = response.headers.get("content-type")
    if (contentType && contentType.indexOf("text/html") !== -1) {
      throw new Error('La API de pagos no está disponible (404). Por favor, contacte al administrador.')
    }
    
    const result = await response.json()
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Error al cargar datos')
    }
    
    setPaymentData(result.data)
    setFilteredData(result.data)
    calculateTotals(result.data)
  } catch (error: any) {
    console.error('Error al cargar datos:', error)
    setError(error.message || 'Error al conectar con el servidor')
  } finally {
    setLoading(false)
  }
}

  const applyFilters = () => {
    let filtered = [...paymentData]

    // Filtrar por banco
    if (bankFilter) {
      filtered = filtered.filter(payment => 
        payment.Banco.toLowerCase().includes(bankFilter.toLowerCase())
      )
    }

    // Filtrar por fecha
    if (dateFromFilter) {
      const fromDate = new Date(dateFromFilter)
      filtered = filtered.filter(payment => {
        const paymentDate = new Date(payment.Fecha)
        return paymentDate >= fromDate
      })
    }

    if (dateToFilter) {
      const toDate = new Date(dateToFilter)
      toDate.setHours(23, 59, 59, 999) // Incluir todo el día
      filtered = filtered.filter(payment => {
        const paymentDate = new Date(payment.Fecha)
        return paymentDate <= toDate
      })
    }

    setFilteredData(filtered)
    calculateTotals(filtered)
  }

  const calculateTotals = (data: PaymentData[]) => {
    const total = data.reduce((acc, payment) => acc + payment.Cantidad, 0)
    setTotalCantidad(total)
  }

  const clearFilters = () => {
    setBankFilter('')
    setDateFromFilter('')
    setDateToFilter('')
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return format(date, 'dd/MM/yyyy HH:mm', { locale: es })
    } catch (error) {
      return dateString
    }
  }

  // Agrupar datos por banco
  const groupedByBank = useMemo(() => {
    const grouped: { [key: string]: PaymentData[] } = {}
    
    filteredData.forEach(payment => {
      const bank = payment.Banco || 'Sin banco'
      if (!grouped[bank]) {
        grouped[bank] = []
      }
      grouped[bank].push(payment)
    })
    
    // Ordenar bancos alfabéticamente
    return Object.keys(grouped)
      .sort()
      .reduce((acc, key) => {
        acc[key] = grouped[key]
        return acc
      }, {} as { [key: string]: PaymentData[] })
  }, [filteredData])

  // Calcular total por banco
  const calculateBankTotal = (bankData: PaymentData[]) => {
    return bankData.reduce((acc, payment) => acc + payment.Cantidad, 0)
  }

  // Exportar a Excel
  const exportToExcel = () => {
    // Preparar los datos para Excel
    const excelData: any[] = []
    
    Object.entries(groupedByBank).forEach(([bankName, bankData]) => {
      // Agregar encabezado del banco
      excelData.push({
        'Fecha': `BANCO: ${bankName}`,
        'Numero': '',
        'Banco': '',
        'Cantidad': '',
        'Referencia': '',
        'Comentario': '',
        'NumeroPrestamo': '',
        'NombreCliente': '',
        'CedulaRif': ''
      })
      
      // Agregar datos del banco
      bankData.forEach(payment => {
        excelData.push({
          'Fecha': formatDate(payment.Fecha),
          'Numero': payment.Numero,
          'Banco': payment.Banco,
          'Cantidad': payment.Cantidad,
          'Referencia': payment.Referencia,
          'Comentario': payment.Comentario,
          'NumeroPrestamo': payment.NumeroPrestamo || 'N/A',
          'NombreCliente': payment.NombreCliente || 'N/A',
          'CedulaRif': payment.CedulaRif || 'N/A'
        })
      })
      
      // Agregar total del banco
      const bankTotal = calculateBankTotal(bankData)
      excelData.push({
        'Fecha': `TOTAL ${bankName}`,
        'Numero': '',
        'Banco': '',
        'Cantidad': bankTotal,
        'Referencia': '',
        'Comentario': '',
        'NumeroPrestamo': '',
        'NombreCliente': '',
        'CedulaRif': ''
      })
      
      // Agregar fila vacía para separación
      excelData.push({})
    })
    
    // Agregar total general
    excelData.push({
      'Fecha': 'TOTAL GENERAL',
      'Numero': '',
      'Banco': '',
      'Cantidad': totalCantidad,
      'Referencia': '',
      'Comentario': '',
      'NumeroPrestamo': '',
      'NombreCliente': '',
      'CedulaRif': ''
    })

    // Crear libro de trabajo
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(excelData)
    
    // Establecer anchos de columnas
    const colWidths = [
      { wch: 20 },  // Fecha
      { wch: 10 },  // Numero
      { wch: 25 },  // Banco
      { wch: 15 },  // Cantidad
      { wch: 20 },  // Referencia
      { wch: 30 },  // Comentario
      { wch: 20 },  // NumeroPrestamo
      { wch: 30 },  // NombreCliente
      { wch: 20 }   // CedulaRif
    ]
    worksheet['!cols'] = colWidths

    // Agregar hoja al libro
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte Consolidación')

    // Generar archivo
    XLSX.writeFile(workbook, `reporte_consolidacion_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // Exportar a PDF
  const exportToPDF = async () => {
    try {
      // Crear documento PDF
      const doc = new jsPDF('landscape')
      
      // Título
      doc.setFontSize(16)
      doc.text('Reporte de Consolidación de Pagos', 14, 15)
      
      // Fecha de generación
      doc.setFontSize(10)
      doc.text(`Generado el: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 22)
      
      // Información de filtros
      let yPos = 30
      const filters: string[] = []
      
      if (bankFilter) filters.push(`Banco: ${bankFilter}`)
      if (dateFromFilter || dateToFilter) {
        filters.push(`Fecha: ${dateFromFilter || 'Inicio'} a ${dateToFilter || 'Fin'}`)
      }
      
      if (filters.length > 0) {
        doc.setFontSize(10)
        doc.text(`Filtros aplicados: ${filters.join(', ')}`, 14, yPos)
        yPos += 8
      }
      
      // Total general
      doc.setFontSize(11)
      doc.text(`Total General: $${formatCurrency(totalCantidad)}`, 14, yPos)
      yPos += 10
      
      // Preparar datos para cada banco
      Object.entries(groupedByBank).forEach(([bankName, bankData], index) => {
        if (index > 0) {
          doc.addPage()
          yPos = 20
        }
        
        // Título del banco
        doc.setFontSize(14)
        doc.text(`BANCO: ${bankName}`, 14, yPos)
        yPos += 8
        
        // Total del banco
        const bankTotal = calculateBankTotal(bankData)
        doc.setFontSize(11)
        doc.text(`Total ${bankName}: $${formatCurrency(bankTotal)}`, 14, yPos)
        yPos += 10
        
        // Preparar datos para la tabla
        const headers = [
          ['Fecha', 'Número', 'Banco', 'Cantidad', 'Referencia', 'Comentario', 'Número Préstamo', 'Nombre Cliente', 'Cédula/RIF']
        ]
        
        const data = bankData.map(payment => [
          formatDate(payment.Fecha),
          payment.Numero.toString(),
          payment.Banco,
          `$${formatCurrency(payment.Cantidad)}`,
          payment.Referencia,
          payment.Comentario || '',
          payment.NumeroPrestamo || 'N/A',
          payment.NombreCliente || 'N/A',
          payment.CedulaRif || 'N/A'
        ])
        
        // Agregar fila de total del banco
        data.push([
          `TOTAL ${bankName}`,
          '',
          '',
          `$${formatCurrency(bankTotal)}`,
          '',
          '',
          '',
          '',
          ''
        ])
        
        // Configurar la tabla
        ;(doc as any).autoTable({
          startY: yPos,
          head: headers,
          body: data,
          theme: 'grid',
          headStyles: {
            fillColor: [41, 128, 185],
            textColor: 255,
            fontSize: 8
          },
          bodyStyles: {
            fontSize: 7
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245]
          },
          margin: { left: 14, right: 14 },
          pageBreak: 'auto',
          rowPageBreak: 'avoid',
          styles: {
            overflow: 'linebreak',
            cellWidth: 'wrap'
          },
          columnStyles: {
            0: { cellWidth: 25 },  // Fecha
            1: { cellWidth: 15 },  // Número
            2: { cellWidth: 25 },  // Banco
            3: { cellWidth: 20 },  // Cantidad
            4: { cellWidth: 25 },  // Referencia
            5: { cellWidth: 30 },  // Comentario
            6: { cellWidth: 25 },  // Número Préstamo
            7: { cellWidth: 30 },  // Nombre Cliente
            8: { cellWidth: 25 }   // Cédula/RIF
          }
        })
        
        // Actualizar posición Y
        yPos = (doc as any).lastAutoTable.finalY + 10
      })
      
      // Agregar página para total general si hay múltiples bancos
      if (Object.keys(groupedByBank).length > 1) {
        doc.addPage()
        yPos = 20
        doc.setFontSize(16)
        doc.text('RESUMEN GENERAL', 14, yPos)
        yPos += 10
        doc.setFontSize(12)
        doc.text(`Total General Consolidado: $${formatCurrency(totalCantidad)}`, 14, yPos)
      }
      
      // Pie de página
      const pageCount = (doc as any).internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.text(
          `Página ${i} de ${pageCount}`,
          doc.internal.pageSize.width - 30,
          doc.internal.pageSize.height - 10
        )
      }
      
      // Guardar PDF
      doc.save(`reporte_consolidacion_${new Date().toISOString().split('T')[0]}.pdf`)
      
    } catch (error) {
      console.error('Error al generar PDF:', error)
      alert('Error al generar el PDF. Por favor, intente exportar en otro formato.')
    }
  }

  // Obtener lista única de bancos
  const uniqueBanks = useMemo(() => {
    const banks = new Set(paymentData.map(payment => payment.Banco).filter(b => b))
    return Array.from(banks).sort()
  }, [paymentData])

  if (loading) {
    return (
      <AuthGuard>
        <Container fluid className="p-4">
          <div className="d-flex justify-content-center align-items-center" style={{ height: '50vh' }}>
            <div className="text-center">
              <div className="spinner-border text-primary mb-3" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
              <p>Cargando datos de consolidación...</p>
            </div>
          </div>
        </Container>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard>
      <Container fluid className="p-4">
        {/* Header */}
        <Row className="mb-4">
          <Col>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h1 className="h3 mb-0">Reportes de Consolidación</h1>
                <nav aria-label="breadcrumb">
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link href="/dashboard">Dashboard</Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Reportes de Consolidación
                    </li>
                  </ol>
                </nav>
              </div>
              <div>
                <Link href="/dashboard" passHref legacyBehavior>
                  <Button variant="outline-primary" className="me-2">
                    <BiArrowBack className="me-1" />
                    Volver al Dashboard
                  </Button>
                </Link>
                <Button variant="outline-success" onClick={loadData} className="me-2">
                  <BiRefresh className="me-1" />
                  Actualizar
                </Button>
                <Dropdown>
                  <Dropdown.Toggle variant="primary" id="dropdown-export">
                    <BiDownload className="me-1" />
                    Exportar
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item onClick={exportToExcel}>
                      <BiTable className="me-2" />
                      Excel
                    </Dropdown.Item>
                    <Dropdown.Item onClick={exportToPDF}>
                      <BiFile className="me-2" />
                      PDF
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </div>
            </div>
          </Col>
        </Row>

        {/* Mostrar error si existe */}
        {error && (
          <Row className="mb-4">
            <Col>
              <Alert variant="danger">
                <strong>Error:</strong> {error}
                <div className="mt-2">
                  <Button variant="outline-danger" size="sm" onClick={loadData}>
                    <BiRefresh className="me-1" />
                    Reintentar
                  </Button>
                </div>
              </Alert>
            </Col>
          </Row>
        )}

        {/* Filtros */}
        <Row className="mb-4">
          <Col>
            <Card>
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="card-title mb-0">
                    <BiFilter className="me-2" />
                    Filtros de Búsqueda
                  </h5>
                  <Button variant="outline-secondary" size="sm" onClick={clearFilters}>
                    <BiX className="me-1" />
                    Limpiar Filtros
                  </Button>
                </div>
                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <BiBuilding className="me-1" />
                        Nombre del Banco
                      </Form.Label>
                      <InputGroup>
                        <InputGroup.Text>
                          <BiSearch />
                        </InputGroup.Text>
                        <FormControl
                          placeholder="Buscar banco..."
                          value={bankFilter}
                          onChange={(e) => setBankFilter(e.target.value)}
                          list="bankSuggestions"
                        />
                        <datalist id="bankSuggestions">
                          {uniqueBanks.map((bank, index) => (
                            <option key={index} value={bank} />
                          ))}
                        </datalist>
                      </InputGroup>
                    </Form.Group>
                  </Col>
                  
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <BiCalendar className="me-1" />
                        Fecha Desde
                      </Form.Label>
                      <Form.Control
                        type="date"
                        value={dateFromFilter}
                        onChange={(e) => setDateFromFilter(e.target.value)}
                        max={dateToFilter || undefined}
                      />
                    </Form.Group>
                  </Col>
                  
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <BiCalendar className="me-1" />
                        Fecha Hasta
                      </Form.Label>
                      <Form.Control
                        type="date"
                        value={dateToFilter}
                        onChange={(e) => setDateToFilter(e.target.value)}
                        min={dateFromFilter || undefined}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                
                <Row>
                  <Col md={8}>
                    <div className="d-flex align-items-end h-100">
                      <div className="text-muted">
                        Mostrando {filteredData.length} de {paymentData.length} registros
                        <span className="ms-2">
                          | {Object.keys(groupedByBank).length} bancos
                        </span>
                      </div>
                    </div>
                  </Col>
                  
                  <Col md={4}>
                    <div className="text-end">
                      <small className="text-muted">
                        Total Cantidad: <strong>${formatCurrency(totalCantidad)}</strong>
                      </small>
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Total General */}
        <Row className="mb-4">
          <Col>
            <Card className="border-primary">
              <Card.Body className="text-center">
                <h5 className="card-title">
                  <BiDollar className="me-2" />
                  Total General Consolidado
                </h5>
                <h1 className="display-4 text-primary">
                  ${formatCurrency(totalCantidad)}
                </h1>
                <p className="text-muted mb-0">
                  Suma total de todas las cantidades {dateFromFilter || dateToFilter ? 'filtradas' : ''}
                </p>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Tablas por Banco */}
        <div ref={tableRef}>
          {Object.keys(groupedByBank).length === 0 ? (
            <Row>
              <Col>
                <Card>
                  <Card.Body className="text-center py-5">
                    <h4>No hay datos disponibles</h4>
                    <p className="text-muted">
                      No se encontraron registros con los filtros aplicados
                    </p>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          ) : (
            Object.entries(groupedByBank).map(([bankName, bankData]) => {
              const bankTotal = calculateBankTotal(bankData)
              
              return (
                <Row key={bankName} className="mb-4">
                  <Col>
                    <Card>
                      <Card.Header className="bg-primary text-white">
                        <div className="d-flex justify-content-between align-items-center">
                          <h5 className="mb-0">
                            <BiBuilding className="me-2" />
                            {bankName}
                          </h5>
                          <div className="d-flex align-items-center">
                            <span className="me-3">
                              Total: <strong>${formatCurrency(bankTotal)}</strong>
                            </span>
                            <span className="badge bg-light text-dark">
                              {bankData.length} registros
                            </span>
                          </div>
                        </div>
                      </Card.Header>
                      <Card.Body className="p-0">
                        <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                          <Table striped hover className="mb-0">
                            <thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}>
                              <tr>
                                <th>Fecha</th>
                                <th>Número</th>
                                <th>Banco</th>
                                <th>Cantidad</th>
                                <th>Referencia</th>
                                <th>Comentario</th>
                                <th>Número Préstamo</th>
                                <th>Nombre Cliente</th>
                                <th>Cédula/RIF</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bankData.map((payment, index) => (
                                <tr key={`${bankName}-${index}`}>
                                  <td>{formatDate(payment.Fecha)}</td>
                                  <td>{payment.Numero}</td>
                                  <td>
                                    <span className="badge bg-info">
                                      {payment.Banco}
                                    </span>
                                  </td>
                                  <td className="text-end">
                                    <strong>${formatCurrency(payment.Cantidad)}</strong>
                                  </td>
                                  <td>
                                    <small>{payment.Referencia}</small>
                                  </td>
                                  <td>
                                    <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {payment.Comentario || 'N/A'}
                                    </div>
                                  </td>
                                  <td>
                                    {payment.NumeroPrestamo ? (
                                      <span className="badge bg-secondary">
                                        {payment.NumeroPrestamo}
                                      </span>
                                    ) : (
                                      'N/A'
                                    )}
                                  </td>
                                  <td>{payment.NombreCliente || 'N/A'}</td>
                                  <td>{payment.CedulaRif || 'N/A'}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="table-primary">
                                <td colSpan={3} className="text-end">
                                  <strong>Total {bankName}:</strong>
                                </td>
                                <td className="text-end">
                                  <strong>${formatCurrency(bankTotal)}</strong>
                                </td>
                                <td colSpan={5}></td>
                              </tr>
                            </tfoot>
                          </Table>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              )
            })
          )}
        </div>

        {/* Resumen de Bancos */}
        {Object.keys(groupedByBank).length > 0 && (
          <Row className="mt-4">
            <Col>
              <Card>
                <Card.Header>
                  <h5 className="mb-0">Resumen por Banco</h5>
                </Card.Header>
                <Card.Body>
                  <Row>
                    {Object.entries(groupedByBank).map(([bankName, bankData]) => {
                      const bankTotal = calculateBankTotal(bankData)
                      const percentage = (bankTotal / totalCantidad) * 100
                      
                      return (
                        <Col md={4} className="mb-3" key={`summary-${bankName}`}>
                          <Card className="h-100">
                            <Card.Body>
                              <div className="d-flex justify-content-between align-items-center mb-2">
                                <h6 className="mb-0">{bankName}</h6>
                                <span className="badge bg-primary">
                                  {bankData.length} reg.
                                </span>
                              </div>
                              <h4 className="text-primary">
                                ${formatCurrency(bankTotal)}
                              </h4>
                              <div className="progress mb-2">
                                <div 
                                  className="progress-bar bg-success" 
                                  role="progressbar" 
                                  style={{ width: `${percentage}%` }}
                                  aria-valuenow={percentage} 
                                  aria-valuemin={0} 
                                  aria-valuemax={100}
                                >
                                  {percentage.toFixed(1)}%
                                </div>
                              </div>
                              <small className="text-muted">
                                {percentage.toFixed(1)}% del total general
                              </small>
                            </Card.Body>
                          </Card>
                        </Col>
                      )
                    })}
                  </Row>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}
      </Container>
    </AuthGuard>
  )
}