'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Container, Row, Col, Card, Button, Form, Table, Dropdown, InputGroup, FormControl, Alert } from 'react-bootstrap'
import { 
  BiArrowBack, BiDownload, BiFilter, BiCalendar, BiPrinter,
  BiDollar, BiTrendingUp, BiSearch, BiRefresh, BiX, BiFile, BiTable, BiBuilding, BiUser
} from 'react-icons/bi'
import Link from 'next/link'
import AuthGuard from '@/components/AuthGuard'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

// Interfaz para los datos de débitos según la consulta SQL
interface DebitData {
  numero_prestamo: string;
  nombre_cliente: string;
  analista: string;
  fecha_cargo: string;
  descripcion_cargo: string;
  monto: number;
}

export default function ReportesDebitosPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [debitData, setDebitData] = useState<DebitData[]>([])
  const [filteredData, setFilteredData] = useState<DebitData[]>([])
  
  // Estados para los filtros
  const [analistaFilter, setAnalistaFilter] = useState('')
  const [dateFromFilter, setDateFromFilter] = useState('')
  const [dateToFilter, setDateToFilter] = useState('')
  
  // Estado para totales
  const [totalMonto, setTotalMonto] = useState(0)

  // Ref para capturar la tabla para PDF (opcional)
  const tableRef = useRef<HTMLDivElement>(null)

  // Cargar datos iniciales
  useEffect(() => {
    loadData()
  }, [])

  // Aplicar filtros cuando cambien
  useEffect(() => {
    applyFilters()
  }, [analistaFilter, dateFromFilter, dateToFilter, debitData])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/debit')
      
      // Verificar si la respuesta es HTML (error 404)
      const contentType = response.headers.get("content-type")
      if (contentType && contentType.indexOf("text/html") !== -1) {
        throw new Error('La API de débitos no está disponible (404). Por favor, contacte al administrador.')
      }
      
      const result = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al cargar datos de débitos')
      }
      
      setDebitData(result.data)
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
    let filtered = [...debitData]

    // Filtrar por analista
    if (analistaFilter) {
      filtered = filtered.filter(debit => 
        debit.analista.toLowerCase().includes(analistaFilter.toLowerCase())
      )
    }

    // Filtrar por fecha (fecha_cargo)
    if (dateFromFilter) {
      const fromDate = new Date(dateFromFilter)
      filtered = filtered.filter(debit => {
        const debitDate = new Date(debit.fecha_cargo)
        return debitDate >= fromDate
      })
    }

    if (dateToFilter) {
      const toDate = new Date(dateToFilter)
      toDate.setHours(23, 59, 59, 999) // Incluir todo el día
      filtered = filtered.filter(debit => {
        const debitDate = new Date(debit.fecha_cargo)
        return debitDate <= toDate
      })
    }

    setFilteredData(filtered)
    calculateTotals(filtered)
  }

  const calculateTotals = (data: DebitData[]) => {
    const total = data.reduce((acc, debit) => acc + debit.monto, 0)
    setTotalMonto(total)
  }

  const clearFilters = () => {
    setAnalistaFilter('')
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

  // Obtener lista única de analistas para el filtro y datalist
  const uniqueAnalistas = useMemo(() => {
    const analistas = new Set(debitData.map(debit => debit.analista).filter(a => a))
    return Array.from(analistas).sort()
  }, [debitData])

  if (loading) {
    return (
      <AuthGuard>
        <Container fluid className="p-4">
          <div className="d-flex justify-content-center align-items-center" style={{ height: '50vh' }}>
            <div className="text-center">
              <div className="spinner-border text-primary mb-3" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
              <p>Cargando datos de débitos...</p>
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
                <h1 className="h3 mb-0">Reportes de Débitos</h1>
                <nav aria-label="breadcrumb">
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link href="/dashboard">Dashboard</Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Reportes de Débitos
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
                        <BiUser className="me-1" />
                        Analista
                      </Form.Label>
                      <InputGroup>
                        <InputGroup.Text>
                          <BiSearch />
                        </InputGroup.Text>
                        <FormControl
                          placeholder="Buscar analista..."
                          value={analistaFilter}
                          onChange={(e) => setAnalistaFilter(e.target.value)}
                          list="analistaSuggestions"
                        />
                        <datalist id="analistaSuggestions">
                          {uniqueAnalistas.map((analista, index) => (
                            <option key={index} value={analista} />
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
                        Mostrando {filteredData.length} de {debitData.length} registros
                      </div>
                    </div>
                  </Col>
                  
                  <Col md={4}>
                    <div className="text-end">
                      <small className="text-muted">
                        Total Monto: <strong>${formatCurrency(totalMonto)}</strong>
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
                  Total General de Débitos
                </h5>
                <h1 className="display-4 text-primary">
                  ${formatCurrency(totalMonto)}
                </h1>
                <p className="text-muted mb-0">
                  Suma total de todos los montos {dateFromFilter || dateToFilter ? 'filtrados' : ''}
                </p>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Tabla de Débitos */}
        <div ref={tableRef}>
          {filteredData.length === 0 ? (
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
            <Row>
              <Col>
                <Card>
                  <Card.Header className="bg-primary text-white">
                    <div className="d-flex justify-content-between align-items-center">
                      <h5 className="mb-0">
                        <BiTrendingUp className="me-2" />
                        Listado de Débitos
                      </h5>
                      <span className="badge bg-light text-dark">
                        {filteredData.length} registros
                      </span>
                    </div>
                  </Card.Header>
                  <Card.Body className="p-0">
                    <div className="table-responsive" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                      <Table striped hover className="mb-0">
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}>
                          <tr>
                            <th>Fecha</th>
                            <th>N° Préstamo</th>
                            <th>Cliente</th>
                            <th>Analista</th>
                            <th>Descripción</th>
                            <th className="text-end">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredData.map((debit, index) => (
                            <tr key={index}>
                              <td>{formatDate(debit.fecha_cargo)}</td>
                              <td>
                                <span className="badge bg-secondary">
                                  {debit.numero_prestamo}
                                </span>
                              </td>
                              <td>{debit.nombre_cliente}</td>
                              <td>{debit.analista}</td>
                              <td>{debit.descripcion_cargo || 'N/A'}</td>
                              <td className="text-end">
                                <strong>${formatCurrency(debit.monto)}</strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="table-primary">
                            <td colSpan={5} className="text-end">
                              <strong>Total General:</strong>
                            </td>
                            <td className="text-end">
                              <strong>${formatCurrency(totalMonto)}</strong>
                            </td>
                          </tr>
                        </tfoot>
                      </Table>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}
        </div>

        {/* Resumen por Analista (opcional, similar al resumen por banco original) */}
        {filteredData.length > 0 && (
          <Row className="mt-4">
            <Col>
              <Card>
                <Card.Header>
                  <h5 className="mb-0">Resumen por Analista</h5>
                </Card.Header>
                <Card.Body>
                  <Row>
                    {Object.entries(
                      filteredData.reduce((acc, debit) => {
                        const analista = debit.analista || 'Sin analista'
                        if (!acc[analista]) acc[analista] = []
                        acc[analista].push(debit)
                        return acc
                      }, {} as Record<string, DebitData[]>)
                    ).map(([analista, registros]) => {
                      const totalAnalista = registros.reduce((sum, d) => sum + d.monto, 0)
                      const porcentaje = (totalAnalista / totalMonto) * 100
                      return (
                        <Col md={4} className="mb-3" key={analista}>
                          <Card className="h-100">
                            <Card.Body>
                              <div className="d-flex justify-content-between align-items-center mb-2">
                                <h6 className="mb-0">{analista}</h6>
                                <span className="badge bg-primary">
                                  {registros.length} reg.
                                </span>
                              </div>
                              <h4 className="text-primary">
                                ${formatCurrency(totalAnalista)}
                              </h4>
                              <div className="progress mb-2">
                                <div 
                                  className="progress-bar bg-success" 
                                  role="progressbar" 
                                  style={{ width: `${porcentaje}%` }}
                                  aria-valuenow={porcentaje} 
                                  aria-valuemin={0} 
                                  aria-valuemax={100}
                                >
                                  {porcentaje.toFixed(1)}%
                                </div>
                              </div>
                              <small className="text-muted">
                                {porcentaje.toFixed(1)}% del total general
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

  // Funciones de exportación (ajustadas a los nuevos campos)
  function exportToExcel() {
    const excelData = filteredData.map(debit => ({
      'Fecha': formatDate(debit.fecha_cargo),
      'N° Préstamo': debit.numero_prestamo,
      'Cliente': debit.nombre_cliente,
      'Analista': debit.analista,
      'Descripción': debit.descripcion_cargo,
      'Monto': debit.monto
    }))

    // Agregar fila de total
    excelData.push({
      'Fecha': 'TOTAL GENERAL',
      'N° Préstamo': '',
      'Cliente': '',
      'Analista': '',
      'Descripción': '',
      'Monto': totalMonto
    })

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(excelData)
    
    // Anchos de columna
    const colWidths = [
      { wch: 20 }, // Fecha
      { wch: 15 }, // N° Préstamo
      { wch: 30 }, // Cliente
      { wch: 20 }, // Analista
      { wch: 40 }, // Descripción
      { wch: 15 }  // Monto
    ]
    worksheet['!cols'] = colWidths

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Débitos')
    XLSX.writeFile(workbook, `reporte_debitos_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  function exportToPDF() {
    try {
      const doc = new jsPDF('landscape')
      
      // Título
      doc.setFontSize(16)
      doc.text('Reporte de Débitos', 14, 15)
      
      // Fecha de generación
      doc.setFontSize(10)
      doc.text(`Generado el: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 22)
      
      // Filtros aplicados
      let yPos = 30
      const filters: string[] = []
      if (analistaFilter) filters.push(`Analista: ${analistaFilter}`)
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
      doc.text(`Total General: $${formatCurrency(totalMonto)}`, 14, yPos)
      yPos += 10
      
      // Cabeceras de la tabla
      const headers = [['Fecha', 'N° Préstamo', 'Cliente', 'Analista', 'Descripción', 'Monto']]
      const data = filteredData.map(debit => [
        formatDate(debit.fecha_cargo),
        debit.numero_prestamo,
        debit.nombre_cliente,
        debit.analista,
        debit.descripcion_cargo || 'N/A',
        `$${formatCurrency(debit.monto)}`
      ])
      
      // Agregar fila de total
      data.push(['TOTAL GENERAL', '', '', '', '', `$${formatCurrency(totalMonto)}`])
      
      // Configurar autoTable
      ;(doc as any).autoTable({
        startY: yPos,
        head: headers,
        body: data,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 14, right: 14 },
        styles: { overflow: 'linebreak', cellWidth: 'wrap' },
        columnStyles: {
          0: { cellWidth: 25 }, // Fecha
          1: { cellWidth: 20 }, // N° Préstamo
          2: { cellWidth: 40 }, // Cliente
          3: { cellWidth: 25 }, // Analista
          4: { cellWidth: 50 }, // Descripción
          5: { cellWidth: 20 }  // Monto
        }
      })
      
      // Pie de página
      const pageCount = (doc as any).internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10)
      }
      
      doc.save(`reporte_debitos_${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (error) {
      console.error('Error al generar PDF:', error)
      alert('Error al generar el PDF. Por favor, intente exportar en otro formato.')
    }
  }
}