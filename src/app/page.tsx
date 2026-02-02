'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Form, Button, Container, Row, Col, Card, Alert } from 'react-bootstrap'
import 'bootstrap/dist/css/bootstrap.min.css'
import styles from './Login.module.css'

export default function LoginPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState('')
  const [rememberMe, setRememberMe] = useState(false)

  // Verificar si ya está logueado
  useEffect(() => {
    const loggedIn = localStorage.getItem('isLoggedIn')
    if (loggedIn === 'true') {
      router.push('/dashboard')
    }
  }, [router])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Convertir a mayúsculas
    const usuarioUpper = usuario.toUpperCase()
    const contrasenaUpper = contrasena.toUpperCase()
    
    // Validar credenciales
    if (usuarioUpper === 'ADMN' && contrasenaUpper === 'IMB2022') {
      // Guardar estado de login
      localStorage.setItem('isLoggedIn', 'true')
      localStorage.setItem('usuario', usuarioUpper)
      
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true')
      }
      
      // Redirigir al dashboard
      router.push('/dashboard')
    } else {
      setError('Usuario o contraseña incorrectos')
    }
  }

  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => 
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Convertir a mayúsculas en tiempo real
      setter(e.target.value.toUpperCase())
    }

  return (
    <div className={styles.loginContainer}>
      <Container fluid className="h-100">
        <Row className="h-100 justify-content-center align-items-center">
          <Col xs={12} sm={10} md={8} lg={6} xl={4}>
            <Card className={styles.loginCard}>
              <Card.Body className="p-5">
                {/* Logo y título */}
                <div className="text-center mb-4">
                  <div className={styles.logoContainer}>
                    <span className={styles.logoText}>QFI</span>
                  </div>
                  <h3 className={styles.companyName}>Financial Services</h3>
                  <h5 className={styles.welcomeText}>Bienvenido</h5>
                </div>

                

                {/* Formulario */}
                <Form onSubmit={handleSubmit}>
                  {error && (
                    <Alert variant="danger" className="text-center">
                      {error}
                    </Alert>
                  )}

                  <Form.Group className="mb-3" controlId="formUsuario">
                    <Form.Label className={styles.formLabel}>Usuario</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Usuario"
                      value={usuario}
                      onChange={handleInputChange(setUsuario)}
                      className={styles.formControl}
                      required
                    />
                  </Form.Group>

                  <Form.Group className="mb-3" controlId="formContrasena">
                    <Form.Label className={styles.formLabel}>Contraseña</Form.Label>
                    <Form.Control
                      type="password"
                      placeholder="Contraseña"
                      value={contrasena}
                      onChange={handleInputChange(setContrasena)}
                      className={styles.formControl}
                      required
                    />
                  </Form.Group>

                  <div className="mb-3 form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="rememberMe"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <label className={`form-check-label ${styles.rememberText}`} htmlFor="rememberMe">
                      Recordarme
                    </label>
                  </div>

                  <Button 
                    variant="primary" 
                    type="submit" 
                    className={`w-100 ${styles.loginButton}`}
                  >
                    Iniciar sesión
                  </Button>
                </Form>

            
              

                {/* Información de contacto */}
                <div className="text-center mt-5">
                  <p className={styles.contactText}>
                    ¿Necesitas ayuda? <a href="#" className={styles.contactLink}>Contáctanos</a>
                  </p>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  )
}