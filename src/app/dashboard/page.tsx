'use client'

import { useState } from 'react'
import { Container, Row, Col, Card, Button, Navbar, Nav, Dropdown } from 'react-bootstrap'
import { 
  BiBarChartAlt2, BiUser, BiCreditCard, BiBell, BiLogOut,
  BiTrendingUp, BiDollar, BiGroup, BiFile, BiHome,
  BiCalendar, BiPieChartAlt, BiLineChart, BiWallet
} from 'react-icons/bi'
import Link from 'next/link'
import AuthGuard from '@/components/AuthGuard'

export default function DashboardPage() {
  const [activeMenu, setActiveMenu] = useState('dashboard')

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('usuario')
    window.location.href = '/'
  }

  const reportesRapidos = [
    {
      id: 1,
      titulo: 'Reportes de Financiación',
      descripcion: 'Análisis detallado de préstamos',
      icono: <BiDollar size={32} className="text-primary" />,
      color: 'primary',
      ruta: '/dashboard/reportes-financiacion'
    },
    {
      id: 2,
      titulo: 'Reporte de Consolidación',
      descripcion: 'Reporte de Consolidacion Bancaria',
      icono: <BiGroup size={32} className="text-success" />,
      color: 'success',
      ruta: '/dashboard/reportes-consolidacion'
    },
    {
      id: 3,
      titulo: 'Reporte Estado de Cuenta',
      descripcion: 'Analisis de Estado Cuenta',
      icono: <BiPieChartAlt size={32} className="text-warning" />,
      color: 'warning',
      ruta: '/dashboard/reportes-estadocuenta'
    },
    {
      id: 4,
      titulo: 'Reportes de Cobranza',
      descripcion: 'Seguimiento y estado de cobranzas',
      icono: <BiWallet size={32} className="text-info" />,
      color: 'info',
      ruta: '/dashboard/reportes-cobranza'
    },
    {
      id: 5,
      titulo: 'Reportes de Desempeño',
      descripcion: 'Métricas de rendimiento y KPI',
      icono: <BiLineChart size={32} className="text-purple" />,
      color: 'purple',
      ruta: '/dashboard/reportes-desempeno'
    },
    {
      id: 6,
      titulo: 'Reportes Personalizados',
      descripcion: 'Crea tus propios reportes a medida',
      icono: <BiBarChartAlt2 size={32} className="text-danger" />,
      color: 'danger',
      ruta: '/dashboard/reportes-personalizados'
    }
  ]

  return (
    <AuthGuard>
      <div className="dashboard-container">
        {/* Header */}
        <Navbar bg="dark" variant="dark" expand="lg" className="px-4">
          <Container fluid>
            <Navbar.Brand href="#" className="d-flex align-items-center">
              <BiBarChartAlt2 className="me-2" size={24} />
              <span>QFI Dashboard</span>
            </Navbar.Brand>
            
            <Nav className="ms-auto align-items-center">
              <Nav.Link href="#" className="position-relative">
                <BiBell size={20} />
                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                  3
                </span>
              </Nav.Link>
              
              <Dropdown align="end">
                <Dropdown.Toggle variant="dark" id="dropdown-user" className="d-flex align-items-center">
                  <div className="me-2 bg-primary rounded-circle d-flex align-items-center justify-content-center" style={{width: '32px', height: '32px'}}>
                    <BiUser size={16} />
                  </div>
                  <span>ADMIN</span>
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item href="#">
                    <BiUser className="me-2" />
                    Mi Perfil
                  </Dropdown.Item>
                  <Dropdown.Item href="#">
                    <BiCreditCard className="me-2" />
                    Configuración
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item onClick={handleLogout}>
                    <BiLogOut className="me-2" />
                    Cerrar Sesión
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </Nav>
          </Container>
        </Navbar>

        {/* Sidebar y contenido */}
        <Container fluid className="mt-3">
          <Row>
            {/* Sidebar */}
            <Col md={3} lg={2} className="d-none d-md-block">
              <Card className="mb-3 shadow-sm">
                <Card.Body className="p-3">
                  <Nav className="flex-column">
                    <Nav.Link 
                      as={Link}
                      href="/dashboard" 
                      className={`mb-2 d-flex align-items-center ${activeMenu === 'dashboard' ? 'active bg-primary text-white' : ''}`}
                      onClick={() => setActiveMenu('dashboard')}
                    >
                      <BiHome className="me-2" />
                      Dashboard
                    </Nav.Link>
                    <Nav.Link 
                      href="#" 
                      className={`mb-2 d-flex align-items-center ${activeMenu === 'clientes' ? 'active bg-primary text-white' : ''}`}
                      onClick={() => setActiveMenu('clientes')}
                    >
                      <BiGroup className="me-2" />
                      Clientes
                    </Nav.Link>
                    
                    <Nav.Link 
                      href="#" 
                      className={`mb-2 d-flex align-items-center ${activeMenu === 'reportes' ? 'active bg-primary text-white' : ''}`}
                      onClick={() => setActiveMenu('reportes')}
                    >
                      <BiFile className="me-2" />
                      Reportes
                    </Nav.Link>
                    
                  </Nav>
                </Card.Body>
              </Card>

              {/* Widget de estadísticas rápidas */}
              <Card className="shadow-sm">
                <Card.Header className="bg-primary text-white py-2">
                  <small className="fw-bold">Resumen Rápido</small>
                </Card.Header>
                <Card.Body className="p-3">
                  <div className="d-flex justify-content-between mb-2">
                    <small>Préstamos Activos</small>
                    <small className="fw-bold">24</small>
                  </div>
                  <div className="d-flex justify-content-between mb-2">
                    <small>Clientes</small>
                    <small className="fw-bold">89</small>
                  </div>
                  <div className="d-flex justify-content-between mb-2">
                    <small>Pagos Hoy</small>
                    <small className="fw-bold">12</small>
                  </div>
                  <div className="d-flex justify-content-between">
                    <small>Vencidos</small>
                    <small className="fw-bold text-danger">3</small>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            {/* Contenido principal */}
            <Col md={9} lg={10}>
              {/* Bienvenida y estadísticas principales */}
              <Row className="mb-4">
                <Col>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div>
                      <h1 className="h3 mb-1">Bienvenido, ADMIN</h1>
                      <p className="text-muted mb-0">Panel de control y reportes financieros</p>
                    </div>
                    
                  </div>
                </Col>
              </Row>

            

              {/* Sección de Acceso Rápido a Reportes */}
              <Row className="mb-4">
                <Col>
                  <Card className="border-0 shadow-sm">
                    <Card.Header className="bg-white border-0 py-3">
                      <h5 className="mb-0 d-flex align-items-center">
                        <BiBarChartAlt2 className="me-2 text-primary" />
                        Acceso Rápido a Reportes
                      </h5>
                      <p className="text-muted mb-0 mt-1">Accede rápidamente a los reportes más utilizados</p>
                    </Card.Header>
                    <Card.Body>
                      <Row>
                        {reportesRapidos.map((reporte) => (
                          <Col lg={4} md={6} className="mb-3" key={reporte.id}>
                            <Card 
                              className={`h-100 border-${reporte.color} border-top-0 border-end-0 border-bottom-0 border-3 shadow-hover`}
                              style={{ cursor: 'pointer' }}
                              onClick={() => window.location.href = reporte.ruta}
                            >
                              <Card.Body className="d-flex flex-column">
                                <div className="d-flex align-items-center mb-3">
                                  <div className={`bg-${reporte.color} bg-opacity-10 p-2 rounded-circle me-3`}>
                                    {reporte.icono}
                                  </div>
                                  <div>
                                    <h6 className="mb-0">{reporte.titulo}</h6>
                                  </div>
                                </div>
                                <p className="text-muted small flex-grow-1">
                                  {reporte.descripcion}
                                </p>
                                <div className="d-flex justify-content-between align-items-center mt-2">
                                  <small className={`text-${reporte.color} fw-bold`}>
                                    Acceder →
                                  </small>
                                  <Button 
                                    variant={reporte.color as any} 
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      window.location.href = reporte.ruta
                                    }}
                                  >
                                    Ver Reporte
                                  </Button>
                                </div>
                              </Card.Body>
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              
          
              
            </Col>
          </Row>
        </Container>
      </div>
    </AuthGuard>
  )
}