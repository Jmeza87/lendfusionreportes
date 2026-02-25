// app/reportes-estadocuenta/page.jsx
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Container, Row, Col, Card, Button, Form, Table, Dropdown,
  InputGroup, FormControl, Alert, Badge
} from 'react-bootstrap';
import {
  BiArrowBack, BiDownload, BiFilter, BiCalendar, BiFile,
  BiDollar, BiTrendingUp, BiSearch, BiRefresh, BiX, BiTable, BiUser
} from 'react-icons/bi';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Interfaz para los datos de balance
interface BalanceData {
  'Numero de prestamo': string;
  'Nombre del cliente': string;
  'Cedula/Rif': string;
  'Ciudad': string;
  'Direccion Completa': string;
  'Monto financiado': number;
  'Tasa interes %': number;
  'Total cuotas': number;
  'Numero de cuota': number;
  'Monto capital cuota': number;
  'Monto interes cuota': number;
  'Cuota + interes': number;
  'Pagado': number;
  'Fecha de vencimiento': string;
  'Dias para vencer': number;
  'Estado cuota': string; // PAGADO, VENCIDO, PENDIENTE
  'Vendedor': string;
  'Analista': string;
}

export default function ReportesEstadoCuentaPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balanceData, setBalanceData] = useState<BalanceData[]>([]);
  const [filteredData, setFilteredData] = useState<BalanceData[]>([]);

  // Estados para los filtros
  const [loanNumberFilter, setLoanNumberFilter] = useState('');
  const [clientNameFilter, setClientNameFilter] = useState('');
  const [analystFilter, setAnalystFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [daysRangeFilter, setDaysRangeFilter] = useState('');

  // Totales
  const [totalFinanciado, setTotalFinanciado] = useState(0);
  const [totalCapitalCuota, setTotalCapitalCuota] = useState(0);
  const [totalInteresCuota, setTotalInteresCuota] = useState(0);
  const [totalCuotaInteres, setTotalCuotaInteres] = useState(0);
  const [totalPagado, setTotalPagado] = useState(0);

  // Ref para capturar la tabla para PDF
  const tableRef = useRef<HTMLDivElement>(null);

  // Definición de rangos de días (atraso)
  const daysRanges = [
    { value: '1-10', label: '1 - 10 días de atraso (🟢)', min: 1, max: 10 },
    { value: '11-20', label: '11 - 20 días de atraso (🟡)', min: 11, max: 20 },
    { value: '21-30', label: '21 - 30 días de atraso (🟡)', min: 21, max: 30 },
    { value: '31-45', label: '31 - 45 días de atraso (🟠)', min: 31, max: 45 },
    { value: '46-60', label: '46 - 60 días de atraso (🔴)', min: 46, max: 60 },
    { value: '61+', label: '+61 días de atraso (⛔)', min: 61, max: Infinity }
  ];

  // Cargar datos iniciales
  useEffect(() => {
    loadData();
  }, []);

  // Aplicar filtros cuando cambien
  useEffect(() => {
    applyFilters();
  }, [loanNumberFilter, clientNameFilter, analystFilter, statusFilter, dateFromFilter, dateToFilter, daysRangeFilter, balanceData]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/balance');

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.indexOf('text/html') !== -1) {
        throw new Error('La API de balances no está disponible. Por favor, contacte al administrador.');
      }

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al cargar datos');
      }

      setBalanceData(result.data);
      setFilteredData(result.data);
      calculateTotals(result.data);
    } catch (error: any) {
      console.error('Error al cargar datos:', error);
      setError(error.message || 'Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...balanceData];

    // Filtrar por número de préstamo
    if (loanNumberFilter) {
      filtered = filtered.filter(item =>
        item['Numero de prestamo'].toLowerCase().includes(loanNumberFilter.toLowerCase())
      );
    }

    // Filtrar por nombre de cliente
    if (clientNameFilter) {
      filtered = filtered.filter(item =>
        item['Nombre del cliente'].toLowerCase().includes(clientNameFilter.toLowerCase())
      );
    }

    // Filtrar por analista
    if (analystFilter) {
      filtered = filtered.filter(item => item.Analista === analystFilter);
    }

    // Filtrar por estado de cuota
    if (statusFilter) {
      filtered = filtered.filter(item => item['Estado cuota'] === statusFilter);
    }

    // Filtrar por rango de fecha de vencimiento
    if (dateFromFilter) {
      const fromDate = new Date(dateFromFilter);
      filtered = filtered.filter(item => {
        const dueDate = new Date(item['Fecha de vencimiento']);
        return dueDate >= fromDate;
      });
    }

    if (dateToFilter) {
      const toDate = new Date(dateToFilter);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(item => {
        const dueDate = new Date(item['Fecha de vencimiento']);
        return dueDate <= toDate;
      });
    }

    // Filtrar por rango de días de atraso (solo vencidos)
    if (daysRangeFilter) {
      const range = daysRanges.find(r => r.value === daysRangeFilter);
      if (range) {
        filtered = filtered.filter(item => {
          const days = item['Dias para vencer'];
          // Solo cuotas vencidas con días negativos
          return item['Estado cuota'] === 'VENCIDO' && days < 0 && Math.abs(days) >= range.min && Math.abs(days) <= range.max;
        });
      }
    }

    setFilteredData(filtered);
    calculateTotals(filtered);
  };

  const calculateTotals = (data: BalanceData[]) => {
    const financiado = data.reduce((acc, item) => acc + (item['Monto financiado'] || 0), 0);
    const capital = data.reduce((acc, item) => acc + (item['Monto capital cuota'] || 0), 0);
    const interes = data.reduce((acc, item) => acc + (item['Monto interes cuota'] || 0), 0);
    const cuotaInteres = data.reduce((acc, item) => acc + (item['Cuota + interes'] || 0), 0);
    const pagado = data.reduce((acc, item) => acc + (item['Pagado'] || 0), 0);

    setTotalFinanciado(financiado);
    setTotalCapitalCuota(capital);
    setTotalInteresCuota(interes);
    setTotalCuotaInteres(cuotaInteres);
    setTotalPagado(pagado);
  };

  const clearFilters = () => {
    setLoanNumberFilter('');
    setClientNameFilter('');
    setAnalystFilter('');
    setStatusFilter('');
    setDateFromFilter('');
    setDateToFilter('');
    setDaysRangeFilter('');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'dd/MM/yyyy', { locale: es });
    } catch (error) {
      return dateString;
    }
  };

  // Lista única de analistas para el filtro
  const uniqueAnalysts = useMemo(() => {
    const analysts = new Set(balanceData.map(item => item.Analista).filter(Boolean));
    return Array.from(analysts).sort();
  }, [balanceData]);

  // Agrupar datos por número de préstamo
  const groupedByLoan = useMemo(() => {
    const grouped: { [key: string]: BalanceData[] } = {};

    filteredData.forEach(item => {
      const loanNumber = item['Numero de prestamo'];
      if (!grouped[loanNumber]) {
        grouped[loanNumber] = [];
      }
      grouped[loanNumber].push(item);
    });

    return Object.keys(grouped)
      .sort((a, b) => {
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        return numA - numB;
      })
      .reduce((acc, key) => {
        acc[key] = grouped[key];
        return acc;
      }, {} as { [key: string]: BalanceData[] });
  }, [filteredData]);

  // Obtener información resumida de cada préstamo
  const loanSummary = useMemo(() => {
    const summary: { [key: string]: any } = {};
    Object.entries(groupedByLoan).forEach(([loanNumber, installments]) => {
      if (installments.length > 0) {
        const first = installments[0];
        summary[loanNumber] = {
          cliente: first['Nombre del cliente'],
          cedula: first['Cedula/Rif'],
          ciudad: first['Ciudad'],
          direccion: first['Direccion Completa'],
          montoFinanciado: first['Monto financiado'],
          tasa: first['Tasa interes %'],
          totalCuotas: first['Total cuotas'],
          vendedor: first['Vendedor'],
          analista: first['Analista'],
          installments: installments.sort((a, b) => a['Numero de cuota'] - b['Numero de cuota'])
        };
      }
    });
    return summary;
  }, [groupedByLoan]);

  // Totales por préstamo
  const calculateLoanTotal = (installments: BalanceData[], field: keyof BalanceData) => {
    return installments.reduce((acc, item) => acc + (item[field] as number || 0), 0);
  };

  // Función para obtener la clase de badge según los días de atraso (solo vencidos)
  const getDaysBadgeClass = (days: number, estado: string) => {
    if (estado !== 'VENCIDO' || days >= 0) return ''; // Solo vencidos
    const absDays = Math.abs(days);
    if (absDays >= 1 && absDays <= 10) return 'bg-success';
    if (absDays >= 11 && absDays <= 20) return 'bg-warning text-dark';
    if (absDays >= 21 && absDays <= 30) return 'bg-warning text-dark';
    if (absDays >= 31 && absDays <= 45) return 'bg-info';
    if (absDays >= 46 && absDays <= 60) return 'bg-danger';
    if (absDays >= 61) return 'bg-dark text-white';
    return '';
  };

  // Exportar a Excel
  const exportToExcel = () => {
    const excelData: any[] = [];

    Object.entries(loanSummary).forEach(([loanNumber, loan]) => {
      excelData.push({
        'Préstamo': `PRÉSTAMO: ${loanNumber}`,
        'Cliente': loan.cliente,
        'Cédula/RIF': loan.cedula,
        'Ciudad': loan.ciudad,
        'Monto Financiado': loan.montoFinanciado,
        'Tasa %': loan.tasa,
        'Total Cuotas': loan.totalCuotas,
        'Vendedor': loan.vendedor,
        'Analista': loan.analista,
        'N° Cuota': '',
        'Capital Cuota': '',
        'Interés Cuota': '',
        'Cuota+Interés': '',
        'Pagado': '',
        'Vencimiento': '',
        'Estado': ''
      });

      loan.installments.forEach((item: BalanceData) => {
        excelData.push({
          'Préstamo': '',
          'Cliente': '',
          'Cédula/RIF': '',
          'Ciudad': '',
          'Monto Financiado': '',
          'Tasa %': '',
          'Total Cuotas': '',
          'Vendedor': '',
          'Analista': '',
          'N° Cuota': item['Numero de cuota'],
          'Capital Cuota': item['Monto capital cuota'],
          'Interés Cuota': item['Monto interes cuota'],
          'Cuota+Interés': item['Cuota + interes'],
          'Pagado': item['Pagado'],
          'Vencimiento': formatDate(item['Fecha de vencimiento']),
          'Estado': item['Estado cuota']
        });
      });

      const totalCapital = calculateLoanTotal(loan.installments, 'Monto capital cuota');
      const totalInteres = calculateLoanTotal(loan.installments, 'Monto interes cuota');
      const totalCuotaInteres = calculateLoanTotal(loan.installments, 'Cuota + interes');
      const totalPagadoLoan = calculateLoanTotal(loan.installments, 'Pagado');

      excelData.push({
        'Préstamo': `TOTAL ${loanNumber}`,
        'Cliente': '',
        'Cédula/RIF': '',
        'Ciudad': '',
        'Monto Financiado': '',
        'Tasa %': '',
        'Total Cuotas': '',
        'Vendedor': '',
        'Analista': '',
        'N° Cuota': '',
        'Capital Cuota': totalCapital,
        'Interés Cuota': totalInteres,
        'Cuota+Interés': totalCuotaInteres,
        'Pagado': totalPagadoLoan,
        'Vencimiento': '',
        'Estado': ''
      });

      excelData.push({});
    });

    excelData.push({
      'Préstamo': 'TOTALES GENERALES',
      'Cliente': '',
      'Cédula/RIF': '',
      'Ciudad': '',
      'Monto Financiado': totalFinanciado,
      'Tasa %': '',
      'Total Cuotas': '',
      'Vendedor': '',
      'Analista': '',
      'N° Cuota': '',
      'Capital Cuota': totalCapitalCuota,
      'Interés Cuota': totalInteresCuota,
      'Cuota+Interés': totalCuotaInteres,
      'Pagado': totalPagado,
      'Vencimiento': '',
      'Estado': ''
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    const colWidths = [
      { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 15 },
      { wch: 8 },  { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 8 },
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
      { wch: 10 }
    ];
    worksheet['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Estado de Cuenta');
    XLSX.writeFile(workbook, `estado_cuenta_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Exportar a PDF
  const exportToPDF = async () => {
    try {
      const doc = new jsPDF('landscape');

      doc.setFontSize(16);
      doc.text('Reporte de Estado de Cuenta', 14, 15);
      doc.setFontSize(10);
      doc.text(`Generado el: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 22);

      let yPos = 30;
      const filters: string[] = [];
      if (loanNumberFilter) filters.push(`Préstamo: ${loanNumberFilter}`);
      if (clientNameFilter) filters.push(`Cliente: ${clientNameFilter}`);
      if (analystFilter) filters.push(`Analista: ${analystFilter}`);
      if (statusFilter) filters.push(`Estado: ${statusFilter}`);
      if (dateFromFilter || dateToFilter) {
        filters.push(`Vencimiento: ${dateFromFilter || 'Inicio'} a ${dateToFilter || 'Fin'}`);
      }
      if (daysRangeFilter) {
        const range = daysRanges.find(r => r.value === daysRangeFilter);
        if (range) filters.push(`Rango días atraso: ${range.label}`);
      }
      if (filters.length > 0) {
        doc.setFontSize(10);
        doc.text(`Filtros: ${filters.join(', ')}`, 14, yPos);
        yPos += 8;
      }

      doc.setFontSize(11);
      doc.text(`Total Capital Cuotas: $${formatCurrency(totalCapitalCuota)}`, 14, yPos);
      yPos += 6;
      doc.text(`Total Intereses: $${formatCurrency(totalInteresCuota)}`, 14, yPos);
      yPos += 6;
      doc.text(`Total Cuota+Interés: $${formatCurrency(totalCuotaInteres)}`, 14, yPos);
      yPos += 6;
      doc.text(`Total Pagado: $${formatCurrency(totalPagado)}`, 14, yPos);
      yPos += 10;

      Object.entries(loanSummary).forEach(([loanNumber, loan], index) => {
        if (index > 0) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(12);
        doc.text(`Préstamo: ${loanNumber} - ${loan.cliente} (${loan.cedula})`, 14, yPos);
        yPos += 6;
        doc.setFontSize(10);
        doc.text(`Ciudad: ${loan.ciudad} | Dirección: ${loan.direccion}`, 14, yPos);
        yPos += 5;
        doc.text(`Monto Financiado: $${formatCurrency(loan.montoFinanciado)} | Tasa: ${loan.tasa}% | Total Cuotas: ${loan.totalCuotas}`, 14, yPos);
        yPos += 5;
        doc.text(`Vendedor: ${loan.vendedor} | Analista: ${loan.analista}`, 14, yPos);
        yPos += 8;

        const headers = [['N° Cuota', 'Capital', 'Interés', 'Cuota+Interés', 'Pagado', 'Vencimiento', 'Estado', 'Días']];
        const data = loan.installments.map((item: BalanceData) => {
          let daysDisplay = '-';
          if (item['Estado cuota'] === 'VENCIDO' && item['Dias para vencer'] < 0) {
            daysDisplay = Math.abs(item['Dias para vencer']).toString();
          } else if (item['Estado cuota'] !== 'PAGADO' && item['Dias para vencer'] > 0) {
            daysDisplay = item['Dias para vencer'].toString();
          }
          return [
            item['Numero de cuota'].toString(),
            `$${formatCurrency(item['Monto capital cuota'])}`,
            `$${formatCurrency(item['Monto interes cuota'])}`,
            `$${formatCurrency(item['Cuota + interes'])}`,
            `$${formatCurrency(item['Pagado'])}`,
            formatDate(item['Fecha de vencimiento']),
            item['Estado cuota'],
            daysDisplay
          ];
        });

        const totalCapital = calculateLoanTotal(loan.installments, 'Monto capital cuota');
        const totalInteres = calculateLoanTotal(loan.installments, 'Monto interes cuota');
        const totalCuotaInteres = calculateLoanTotal(loan.installments, 'Cuota + interes');
        const totalPagadoLoan = calculateLoanTotal(loan.installments, 'Pagado');

        data.push([
          'TOTAL',
          `$${formatCurrency(totalCapital)}`,
          `$${formatCurrency(totalInteres)}`,
          `$${formatCurrency(totalCuotaInteres)}`,
          `$${formatCurrency(totalPagadoLoan)}`,
          '',
          '',
          ''
        ]);

        (doc as any).autoTable({
          startY: yPos,
          head: headers,
          body: data,
          theme: 'grid',
          headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 8 },
          bodyStyles: { fontSize: 7 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          margin: { left: 14, right: 14 },
          columnStyles: {
            0: { cellWidth: 15 },
            1: { cellWidth: 20 },
            2: { cellWidth: 20 },
            3: { cellWidth: 22 },
            4: { cellWidth: 20 },
            5: { cellWidth: 25 },
            6: { cellWidth: 20 },
            7: { cellWidth: 15 }
          }
        });

        yPos = (doc as any).lastAutoTable.finalY + 10;
      });

      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
          `Página ${i} de ${pageCount}`,
          doc.internal.pageSize.width - 30,
          doc.internal.pageSize.height - 10
        );
      }

      doc.save(`estado_cuenta_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error al generar PDF:', error);
      alert('Error al generar el PDF. Por favor, intente exportar en otro formato.');
    }
  };

  const statusOptions = ['PAGADO', 'VENCIDO', 'PENDIENTE'];

  if (loading) {
    return (
      <AuthGuard>
        <Container fluid className="p-4">
          <div className="d-flex justify-content-center align-items-center" style={{ height: '50vh' }}>
            <div className="text-center">
              <div className="spinner-border text-primary mb-3" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
              <p>Cargando datos de estado de cuenta...</p>
            </div>
          </div>
        </Container>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <Container fluid className="p-4">
        {/* Header */}
        <Row className="mb-4">
          <Col>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h1 className="h3 mb-0">Reporte de Estado de Cuenta</h1>
                <nav aria-label="breadcrumb">
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link href="/dashboard">Dashboard</Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Estado de Cuenta
                    </li>
                  </ol>
                </nav>
              </div>
              <div>
                <Link href="/dashboard" passHref legacyBehavior>
                  <Button variant="outline-primary" className="me-2">
                    <BiArrowBack className="me-1" />
                    Volver
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

        {/* Error */}
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
                  <Col md={2}>
                    <Form.Group className="mb-3">
                      <Form.Label>Número de Préstamo</Form.Label>
                      <InputGroup>
                        <InputGroup.Text>
                          <BiSearch />
                        </InputGroup.Text>
                        <FormControl
                          placeholder="Ej: 12345"
                          value={loanNumberFilter}
                          onChange={(e) => setLoanNumberFilter(e.target.value)}
                        />
                      </InputGroup>
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group className="mb-3">
                      <Form.Label>Nombre del Cliente</Form.Label>
                      <InputGroup>
                        <InputGroup.Text>
                          <BiUser />
                        </InputGroup.Text>
                        <FormControl
                          placeholder="Buscar cliente..."
                          value={clientNameFilter}
                          onChange={(e) => setClientNameFilter(e.target.value)}
                        />
                      </InputGroup>
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group className="mb-3">
                      <Form.Label>Analista</Form.Label>
                      <Form.Select
                        value={analystFilter}
                        onChange={(e) => setAnalystFilter(e.target.value)}
                      >
                        <option value="">Todos</option>
                        {uniqueAnalysts.map(analyst => (
                          <option key={analyst} value={analyst}>{analyst}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group className="mb-3">
                      <Form.Label>Estado de Cuota</Form.Label>
                      <Form.Select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                      >
                        <option value="">Todos</option>
                        {statusOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group className="mb-3">
                      <Form.Label>Vencimiento Desde</Form.Label>
                      <Form.Control
                        type="date"
                        value={dateFromFilter}
                        onChange={(e) => setDateFromFilter(e.target.value)}
                        max={dateToFilter || undefined}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group className="mb-3">
                      <Form.Label>Vencimiento Hasta</Form.Label>
                      <Form.Control
                        type="date"
                        value={dateToFilter}
                        onChange={(e) => setDateToFilter(e.target.value)}
                        min={dateFromFilter || undefined}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row className="mt-3">
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Rango de Días de Atraso</Form.Label>
                      <Form.Select
                        value={daysRangeFilter}
                        onChange={(e) => setDaysRangeFilter(e.target.value)}
                      >
                        <option value="">Todos</option>
                        {daysRanges.map(range => (
                          <option key={range.value} value={range.value}>{range.label}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={8} className="d-flex align-items-end">
                    <div className="text-muted">
                      Mostrando {filteredData.length} cuotas de {balanceData.length} totales
                      <span className="ms-2">| {Object.keys(loanSummary).length} préstamos</span>
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Tarjetas de totales */}
        <Row className="mb-4">
     
          <Col md={2}>
            <Card className="text-center">
              <Card.Body>
                <BiTrendingUp className="text-success fs-2" />
                <h6>Capital Cuotas</h6>
                <h5>${formatCurrency(totalCapitalCuota)}</h5>
              </Card.Body>
            </Card>
          </Col>
          <Col md={2}>
            <Card className="text-center">
              <Card.Body>
                <BiTrendingUp className="text-warning fs-2" />
                <h6>Interés Cuotas</h6>
                <h5>${formatCurrency(totalInteresCuota)}</h5>
              </Card.Body>
            </Card>
          </Col>
          <Col md={2}>
            <Card className="text-center">
              <Card.Body>
                <BiDollar className="text-info fs-2" />
                <h6>Cuota+Interés</h6>
                <h5>${formatCurrency(totalCuotaInteres)}</h5>
              </Card.Body>
            </Card>
          </Col>
          <Col md={2}>
            <Card className="text-center">
              <Card.Body>
                <BiDollar className="text-secondary fs-2" />
                <h6>Pagado</h6>
                <h5>${formatCurrency(totalPagado)}</h5>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Listado de préstamos con sus cuotas */}
        <div ref={tableRef}>
          {Object.keys(loanSummary).length === 0 ? (
            <Row>
              <Col>
                <Card>
                  <Card.Body className="text-center py-5">
                    <h4>No hay datos disponibles</h4>
                    <p className="text-muted">
                      No se encontraron cuotas con los filtros aplicados.
                    </p>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          ) : (
            Object.entries(loanSummary).map(([loanNumber, loan]) => {
              const totalLoan = calculateLoanTotal(loan.installments, 'Cuota + interes');
              const pagadoLoan = calculateLoanTotal(loan.installments, 'Pagado');
              const saldo = totalLoan - pagadoLoan;

              return (
                <Row key={loanNumber} className="mb-4">
                  <Col>
                    <Card>
                      <Card.Header className="bg-primary text-white">
                        <div className="d-flex justify-content-between align-items-center flex-wrap">
                          <div>
                            <h5 className="mb-0">Préstamo: {loanNumber}</h5>
                            <small>{loan.cliente} ({loan.cedula})</small>
                            <br />
                            <small>Analista: <strong>{loan.analista || 'N/A'}</strong></small>
                          </div>
                          <div className="text-end">
                            <Badge bg="light" text="dark" className="me-2">
                              {loan.installments.length} cuotas
                            </Badge>
                            <div>
                              <span>Saldo: </span>
                              <strong>${formatCurrency(saldo)}</strong>
                            </div>
                          </div>
                        </div>
                      </Card.Header>
                      <Card.Body className="p-0">
                        <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                          <Table striped hover className="mb-0">
                            <thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}>
                              <tr>
                                <th>N° Cuota</th>
                                <th>Capital</th>
                                <th>Interés</th>
                                <th>Cuota+Interés</th>
                                <th>Pagado</th>
                                <th>Vencimiento</th>
                                <th>Días</th>
                                <th>Estado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {loan.installments.map((item: BalanceData, idx: number) => {
                                let statusClass = '';
                                if (item['Estado cuota'] === 'PAGADO') statusClass = 'bg-success text-white';
                                else if (item['Estado cuota'] === 'VENCIDO') statusClass = 'bg-danger text-white';
                                else statusClass = 'bg-warning';

                                return (
                                  <tr key={`${loanNumber}-${idx}`}>
                                    <td>{item['Numero de cuota']}</td>
                                    <td className="text-end">${formatCurrency(item['Monto capital cuota'])}</td>
                                    <td className="text-end">${formatCurrency(item['Monto interes cuota'])}</td>
                                    <td className="text-end">${formatCurrency(item['Cuota + interes'])}</td>
                                    <td className="text-end">${formatCurrency(item['Pagado'])}</td>
                                    <td>{formatDate(item['Fecha de vencimiento'])}</td>
                                    <td className="text-center">
                                      {item['Estado cuota'] === 'VENCIDO' && item['Dias para vencer'] < 0 ? (
                                        <Badge className={getDaysBadgeClass(item['Dias para vencer'], item['Estado cuota'])}>
                                          {Math.abs(item['Dias para vencer'])}
                                        </Badge>
                                      ) : item['Dias para vencer'] !== 0 ? (
                                        <span>{item['Dias para vencer']}</span>
                                      ) : '-'}
                                    </td>
                                    <td>
                                      <Badge className={statusClass}>
                                        {item['Estado cuota']}
                                      </Badge>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="table-primary">
                                <td><strong>Total {loanNumber}</strong></td>
                                <td className="text-end"><strong>${formatCurrency(calculateLoanTotal(loan.installments, 'Monto capital cuota'))}</strong></td>
                                <td className="text-end"><strong>${formatCurrency(calculateLoanTotal(loan.installments, 'Monto interes cuota'))}</strong></td>
                                <td className="text-end"><strong>${formatCurrency(totalLoan)}</strong></td>
                                <td className="text-end"><strong>${formatCurrency(pagadoLoan)}</strong></td>
                                <td colSpan={3}></td>
                              </tr>
                            </tfoot>
                          </Table>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              );
            })
          )}
        </div>

        {/* Resumen rápido */}
        {Object.keys(loanSummary).length > 0 && (
          <Row className="mt-4">
            <Col>
              <Card>
                <Card.Header>
                  <h5 className="mb-0">Resumen de Préstamos</h5>
                </Card.Header>
                <Card.Body>
                  <Row>
                    {Object.entries(loanSummary).map(([loanNumber, loan]) => {
                      const totalLoan = calculateLoanTotal(loan.installments, 'Cuota + interes');
                      const pagadoLoan = calculateLoanTotal(loan.installments, 'Pagado');
                      const saldo = totalLoan - pagadoLoan;
                      return (
                        <Col md={3} className="mb-3" key={`summary-${loanNumber}`}>
                          <Card className="h-100">
                            <Card.Body>
                              <h6>Préstamo {loanNumber}</h6>
                              <small>{loan.cliente}</small>
                              <hr />
                              <div className="d-flex justify-content-between">
                                <span>Total:</span>
                                <strong>${formatCurrency(totalLoan)}</strong>
                              </div>
                              <div className="d-flex justify-content-between">
                                <span>Pagado:</span>
                                <strong>${formatCurrency(pagadoLoan)}</strong>
                              </div>
                              <div className="d-flex justify-content-between">
                                <span>Saldo:</span>
                                <strong className={saldo > 0 ? 'text-danger' : 'text-success'}>
                                  ${formatCurrency(saldo)}
                                </strong>
                              </div>
                            </Card.Body>
                          </Card>
                        </Col>
                      );
                    })}
                  </Row>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}
      </Container>
    </AuthGuard>
  );
}