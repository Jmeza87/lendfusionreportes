'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Container, Row, Col, Card, Button, Form, Table, Dropdown, InputGroup, FormControl, Alert } from 'react-bootstrap'
import { 
  BiArrowBack, BiDownload, BiFilter, BiCalendar, BiPrinter,
  BiDollar, BiTrendingUp, BiSearch, BiRefresh, BiX, BiFile, BiTable
} from 'react-icons/bi'
import Link from 'next/link'
import AuthGuard from '@/components/AuthGuard'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import html2canvas from 'html2canvas'

interface LoanData {
  loan_id: number;
  loan_number: string;
  nombre_cliente: string;
  monto_financiado: number;
  tasa_interes: number;
  interes_total: number;
  monto_total: number;
  total_cuotas: number;
  cuotas_pendientes: number;
  cuotas_pagadas: number;
  analista_asignada: string;
  fecha_creacion: string;
  fecha_desembolso: string;
  moneda: string;
}

export default function ReportesFinanciacionPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loanData, setLoanData] = useState<LoanData[]>([])
  const [filteredData, setFilteredData] = useState<LoanData[]>([])
  
  // Estados para los filtros
  const [loanNumberFilter, setLoanNumberFilter] = useState('')
  const [clientNameFilter, setClientNameFilter] = useState('')
  const [analystFilter, setAnalystFilter] = useState('')
  const [dateFromFilter, setDateFromFilter] = useState('')
  const [dateToFilter, setDateToFilter] = useState('')
  
  // Estados para los totales
  const [totales, setTotales] = useState({
    montoFinanciado: 0,
    interesTotal: 0,
    montoTotal: 0
  })

  // Ref para capturar la tabla para PDF
  const tableRef = useRef<HTMLDivElement>(null)

  // Cargar datos iniciales
  useEffect(() => {
    loadData()
  }, [])

  // Aplicar filtros cuando cambien
  useEffect(() => {
    applyFilters()
  }, [loanNumberFilter, clientNameFilter, analystFilter, dateFromFilter, dateToFilter, loanData])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/loans')
      const result = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al cargar datos')
      }
      
      setLoanData(result.data)
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
    let filtered = [...loanData]

    // Filtrar por número de préstamo
    if (loanNumberFilter) {
      filtered = filtered.filter(loan => 
        loan.loan_number.toLowerCase().includes(loanNumberFilter.toLowerCase())
      )
    }

    // Filtrar por nombre de cliente
    if (clientNameFilter) {
      filtered = filtered.filter(loan => 
        loan.nombre_cliente.toLowerCase().includes(clientNameFilter.toLowerCase())
      )
    }

    // Filtrar por analista
    if (analystFilter) {
      if (analystFilter === 'vacios') {
        filtered = filtered.filter(loan => 
          !loan.analista_asignada || loan.analista_asignada.trim() === ''
        )
      } else {
        filtered = filtered.filter(loan => 
          loan.analista_asignada.toLowerCase().includes(analystFilter.toLowerCase())
        )
      }
    }

    // Filtrar por fecha de creación
    if (dateFromFilter) {
      const fromDate = new Date(dateFromFilter)
      filtered = filtered.filter(loan => {
        const loanDate = new Date(loan.fecha_creacion)
        return loanDate >= fromDate
      })
    }

    if (dateToFilter) {
      const toDate = new Date(dateToFilter)
      toDate.setHours(23, 59, 59, 999) // Incluir todo el día
      filtered = filtered.filter(loan => {
        const loanDate = new Date(loan.fecha_creacion)
        return loanDate <= toDate
      })
    }

    setFilteredData(filtered)
    calculateTotals(filtered)
  }

  const calculateTotals = (data: LoanData[]) => {
    const totals = data.reduce((acc, loan) => ({
      montoFinanciado: acc.montoFinanciado + loan.monto_financiado,
      interesTotal: acc.interesTotal + loan.interes_total,
      montoTotal: acc.montoTotal + loan.monto_total
    }), { montoFinanciado: 0, interesTotal: 0, montoTotal: 0 })

    setTotales(totals)
  }

  const clearFilters = () => {
    setLoanNumberFilter('')
    setClientNameFilter('')
    setAnalystFilter('')
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

  // Exportar a CSV (ya existente)
  const exportToCSV = () => {
    const headers = [
      'ID',
      'Número Préstamo',
      'Cliente',
      'Monto Financiado',
      'Tasa',
      'Interés Total',
      'Monto Total',
      'Cuotas',
      'Pendientes',
      'Pagadas',
      'Analista',
      'Fecha Creación',
      'Fecha Desembolso',
      'Moneda'
    ]

    const csvData = filteredData.map(loan => [
      loan.loan_id,
      loan.loan_number,
      `"${loan.nombre_cliente}"`,
      loan.monto_financiado,
      loan.tasa_interes,
      loan.interes_total,
      loan.monto_total,
      loan.total_cuotas,
      loan.cuotas_pendientes,
      loan.cuotas_pagadas,
      loan.analista_asignada,
      loan.fecha_creacion,
      loan.fecha_desembolso,
      loan.moneda
    ])

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `reporte_financiacion_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Exportar a Excel
  const exportToExcel = () => {
    // Preparar los datos para Excel
    const excelData = filteredData.map(loan => ({
      'ID': loan.loan_id,
      'Número Préstamo': loan.loan_number,
      'Cliente': loan.nombre_cliente,
      'Monto Financiado': loan.monto_financiado,
      'Tasa': `${loan.tasa_interes}%`,
      'Interés Total': loan.interes_total,
      'Monto Total': loan.monto_total,
      'Cuotas': loan.total_cuotas,
      'Pendientes': loan.cuotas_pendientes,
      'Pagadas': loan.cuotas_pagadas,
      'Analista': loan.analista_asignada || 'Sin asignar',
      'Fecha Creación': formatDate(loan.fecha_creacion),
      'Fecha Desembolso': formatDate(loan.fecha_desembolso),
      'Moneda': loan.moneda
    }))

    // Agregar fila de totales
    const totalesRow = {
      'ID': 'TOTALES',
      'Número Préstamo': '',
      'Cliente': '',
      'Monto Financiado': totales.montoFinanciado,
      'Tasa': '',
      'Interés Total': totales.interesTotal,
      'Monto Total': totales.montoTotal,
      'Cuotas': '',
      'Pendientes': '',
      'Pagadas': '',
      'Analista': '',
      'Fecha Creación': '',
      'Fecha Desembolso': '',
      'Moneda': ''
    }

    const dataWithTotals = [...excelData, totalesRow]

    // Crear libro de trabajo
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(dataWithTotals)
    
    // Establecer anchos de columnas
    const colWidths = [
      { wch: 5 },   // ID
      { wch: 15 },  // Número Préstamo
      { wch: 40 },  // Cliente
      { wch: 15 },  // Monto Financiado
      { wch: 8 },   // Tasa
      { wch: 15 },  // Interés Total
      { wch: 15 },  // Monto Total
      { wch: 8 },   // Cuotas
      { wch: 10 },  // Pendientes
      { wch: 10 },  // Pagadas
      { wch: 20 },  // Analista
      { wch: 20 },  // Fecha Creación
      { wch: 20 },  // Fecha Desembolso
      { wch: 10 }   // Moneda
    ]
    worksheet['!cols'] = colWidths

    // Agregar hoja al libro
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte Financiación')

    // Generar archivo
    XLSX.writeFile(workbook, `reporte_financiacion_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // Exportar a PDF
  const exportToPDF = async () => {
    if (!tableRef.current) return

    try {
      // Crear documento PDF
      const doc = new jsPDF('landscape')
      
      // Título
      doc.setFontSize(16)
      doc.text('Reporte de Financiación', 14, 15)
      
      // Fecha de generación
      doc.setFontSize(10)
      doc.text(`Generado el: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 22)
      
      // Información de filtros
      let yPos = 30
      const filters: string[] = []
      
      if (loanNumberFilter) filters.push(`Número de préstamo: ${loanNumberFilter}`)
      if (clientNameFilter) filters.push(`Cliente: ${clientNameFilter}`)
      if (analystFilter === 'vacios') {
        filters.push('Analista: Sin asignar')
      } else if (analystFilter) {
        filters.push(`Analista: ${analystFilter}`)
      }
      if (dateFromFilter || dateToFilter) {
        filters.push(`Fecha: ${dateFromFilter || 'Inicio'} a ${dateToFilter || 'Fin'}`)
      }
      
      if (filters.length > 0) {
        doc.setFontSize(10)
        doc.text(`Filtros aplicados: ${filters.join(', ')}`, 14, yPos)
        yPos += 8
      }
      
      // Totales
      doc.setFontSize(11)
      doc.text(`Total Financiado: $${formatCurrency(totales.montoFinanciado)}`, 14, yPos)
      doc.text(`Total Interés: $${formatCurrency(totales.interesTotal)}`, 80, yPos)
      doc.text(`Monto Total: $${formatCurrency(totales.montoTotal)}`, 150, yPos)
      yPos += 10
      
      // Preparar datos para la tabla
      const headers = [
        ['ID', 'Número Préstamo', 'Cliente', 'Monto Financiado', 'Tasa', 'Interés Total', 'Monto Total', 'Cuotas', 'Pendientes', 'Pagadas', 'Analista', 'Fecha Creación', 'Fecha Desembolso', 'Moneda']
      ]
      
      const data = filteredData.map(loan => [
        loan.loan_id.toString(),
        loan.loan_number,
        loan.nombre_cliente,
        `$${formatCurrency(loan.monto_financiado)}`,
        `${loan.tasa_interes}%`,
        `$${formatCurrency(loan.interes_total)}`,
        `$${formatCurrency(loan.monto_total)}`,
        loan.total_cuotas.toString(),
        loan.cuotas_pendientes.toString(),
        loan.cuotas_pagadas.toString(),
        loan.analista_asignada || 'Sin asignar',
        formatDate(loan.fecha_creacion),
        formatDate(loan.fecha_desembolso),
        loan.moneda
      ])
      
      // Agregar fila de totales
      data.push([
        'TOTALES',
        '',
        '',
        `$${formatCurrency(totales.montoFinanciado)}`,
        '',
        `$${formatCurrency(totales.interesTotal)}`,
        `$${formatCurrency(totales.montoTotal)}`,
        '',
        '',
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
          0: { cellWidth: 15 },  // ID
          1: { cellWidth: 25 },  // Número Préstamo
          2: { cellWidth: 40 },  // Cliente
          3: { cellWidth: 25 },  // Monto Financiado
          4: { cellWidth: 15 },  // Tasa
          5: { cellWidth: 25 },  // Interés Total
          6: { cellWidth: 25 },  // Monto Total
          7: { cellWidth: 15 },  // Cuotas
          8: { cellWidth: 20 },  // Pendientes
          9: { cellWidth: 20 },  // Pagadas
          10: { cellWidth: 25 }, // Analista
          11: { cellWidth: 30 }, // Fecha Creación
          12: { cellWidth: 30 }, // Fecha Desembolso
          13: { cellWidth: 15 }  // Moneda
        }
      })
      
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
      doc.save(`reporte_financiacion_${new Date().toISOString().split('T')[0]}.pdf`)
      
    } catch (error) {
      console.error('Error al generar PDF:', error)
      // Fallback: usar html2canvas si hay problemas con autoTable
      try {
        if (tableRef.current) {
          const canvas = await html2canvas(tableRef.current)
          const imgData = canvas.toDataURL('image/png')
          const pdf = new jsPDF('landscape')
          const imgWidth = pdf.internal.pageSize.getWidth()
          const imgHeight = (canvas.height * imgWidth) / canvas.width
          
          pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
          pdf.save(`reporte_financiacion_${new Date().toISOString().split('T')[0]}.pdf`)
        }
      } catch (fallbackError) {
        console.error('Error en fallback de PDF:', fallbackError)
        alert('Error al generar el PDF. Por favor, intente exportar en otro formato.')
      }
    }
  }

  // Obtener lista única de analistas
  const uniqueAnalysts = useMemo(() => {
    const analysts = new Set(loanData.map(loan => loan.analista_asignada).filter(a => a && a.trim() !== ''))
    return Array.from(analysts).sort()
  }, [loanData])

  if (loading) {
    return (
      <AuthGuard>
        <Container fluid className="p-4">
          <div className="d-flex justify-content-center align-items-center" style={{ height: '50vh' }}>
            <div className="text-center">
              <div className="spinner-border text-primary mb-3" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
              <p>Cargando datos de financiación...</p>
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
                <h1 className="h3 mb-0">Reportes de Financiación</h1>
                <nav aria-label="breadcrumb">
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link href="/dashboard">Dashboard</Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Reportes de Financiación
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
                    <Dropdown.Item onClick={exportToCSV}>
                      <BiFile className="me-2" />
                      CSV
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
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>Número de Préstamo</Form.Label>
                      <InputGroup>
                        <InputGroup.Text>
                          <BiSearch />
                        </InputGroup.Text>
                        <FormControl
                          placeholder="Ej: L251212005"
                          value={loanNumberFilter}
                          onChange={(e) => setLoanNumberFilter(e.target.value)}
                        />
                      </InputGroup>
                    </Form.Group>
                  </Col>
                  
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>Nombre del Cliente</Form.Label>
                      <InputGroup>
                        <InputGroup.Text>
                          <BiSearch />
                        </InputGroup.Text>
                        <FormControl
                          placeholder="Buscar cliente..."
                          value={clientNameFilter}
                          onChange={(e) => setClientNameFilter(e.target.value)}
                        />
                      </InputGroup>
                    </Form.Group>
                  </Col>
                  
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>Analista Asignado</Form.Label>
                      <Form.Select 
                        value={analystFilter} 
                        onChange={(e) => setAnalystFilter(e.target.value)}
                      >
                        <option value="">Todos los analistas</option>
                        <option value="vacios">Sin analista asignado</option>
                        {uniqueAnalysts.map((analyst, index) => (
                          <option key={index} value={analyst}>
                            {analyst}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>Fecha Creación Desde</Form.Label>
                      <Form.Control
                        type="date"
                        value={dateFromFilter}
                        onChange={(e) => setDateFromFilter(e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                
                <Row>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>Fecha Creación Hasta</Form.Label>
                      <Form.Control
                        type="date"
                        value={dateToFilter}
                        onChange={(e) => setDateToFilter(e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                  
                  <Col md={9}>
                    <div className="d-flex align-items-end h-100">
                      <div className="text-muted">
                        Mostrando {filteredData.length} de {loanData.length} registros
                      </div>
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Totales */}
        <Row className="mb-4">
          <Col md={4}>
            <Card className="border-primary">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="text-muted">Total Financiado</h6>
                    <h3 className="mb-0">${formatCurrency(totales.montoFinanciado)}</h3>
                  </div>
                  <div className="bg-primary p-3 rounded-circle">
                    <BiDollar size={24} className="text-white" />
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
          
          <Col md={4}>
            <Card className="border-warning">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="text-muted">Total Interés</h6>
                    <h3 className="mb-0">${formatCurrency(totales.interesTotal)}</h3>
                  </div>
                  <div className="bg-warning p-3 rounded-circle">
                    <BiTrendingUp size={24} className="text-white" />
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
          
          <Col md={4}>
            <Card className="border-success">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="text-muted">Monto Total</h6>
                    <h3 className="mb-0">${formatCurrency(totales.montoTotal)}</h3>
                  </div>
                  <div className="bg-success p-3 rounded-circle">
                    <BiDollar size={24} className="text-white" />
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Tabla de datos - Agregar ref para PDF */}
        <div ref={tableRef}>
          <Row>
            <Col>
              <Card>
                <Card.Header>
                  <div className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">Detalle de Financiaciones</h5>
                    <div>
                      <Button variant="outline-primary" className="me-2" onClick={exportToPDF}>
                        <BiPrinter className="me-1" />
                        Imprimir/PDF
                      </Button>
                      <Button variant="primary" onClick={exportToExcel}>
                        <BiDownload className="me-1" />
                        Exportar Excel
                      </Button>
                    </div>
                  </div>
                </Card.Header>
                <Card.Body className="p-0">
                  <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                    <Table striped hover className="mb-0">
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}>
                        <tr>
                          <th>ID</th>
                          <th>Número Préstamo</th>
                          <th>Cliente</th>
                          <th>Monto Financiado</th>
                          <th>Tasa</th>
                          <th>Interés Total</th>
                          <th>Monto Total</th>
                          <th>Cuotas</th>
                          <th>Pendientes</th>
                          <th>Pagadas</th>
                          <th>Analista</th>
                          <th>Fecha Creación</th>
                          <th>Fecha Desembolso</th>
                          <th>Moneda</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredData.length === 0 ? (
                          <tr>
                            <td colSpan={14} className="text-center py-4">
                              <div className="text-muted">
                                {loanData.length === 0 
                                  ? 'No hay datos disponibles' 
                                  : 'No se encontraron registros con los filtros aplicados'}
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredData.map((loan) => (
                            <tr key={loan.loan_id}>
                              <td>{loan.loan_id}</td>
                              <td>
                                <strong>{loan.loan_number}</strong>
                              </td>
                              <td>
                                <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {loan.nombre_cliente}
                                </div>
                              </td>
                              <td className="text-end">${formatCurrency(loan.monto_financiado)}</td>
                              <td className="text-center">{loan.tasa_interes}%</td>
                              <td className="text-end">${formatCurrency(loan.interes_total)}</td>
                              <td className="text-end">
                                <strong>${formatCurrency(loan.monto_total)}</strong>
                              </td>
                              <td className="text-center">{loan.total_cuotas}</td>
                              <td className="text-center">
                                <span className={`badge ${loan.cuotas_pendientes > 0 ? 'bg-warning' : 'bg-success'}`}>
                                  {loan.cuotas_pendientes}
                                </span>
                              </td>
                              <td className="text-center">
                                <span className="badge bg-success">
                                  {loan.cuotas_pagadas}
                                </span>
                              </td>
                              <td>
                                {loan.analista_asignada ? (
                                  <span className="badge bg-info">{loan.analista_asignada}</span>
                                ) : (
                                  <span className="badge bg-secondary">Sin asignar</span>
                                )}
                              </td>
                              <td>{formatDate(loan.fecha_creacion)}</td>
                              <td>{formatDate(loan.fecha_desembolso)}</td>
                              <td>{loan.moneda}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </Table>
                  </div>
                </Card.Body>
                <Card.Footer className="text-muted">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      Mostrando {filteredData.length} de {loanData.length} registros
                    </div>
                    <div className="text-end">
                      <small>
                        <strong>Totales filtrados:</strong> ${formatCurrency(totales.montoFinanciado)} financiado | ${formatCurrency(totales.interesTotal)} interés | ${formatCurrency(totales.montoTotal)} total
                      </small>
                    </div>
                  </div>
                </Card.Footer>
              </Card>
            </Col>
          </Row>
        </div>
      </Container>
    </AuthGuard>
  )
}