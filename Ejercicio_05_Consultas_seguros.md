Analice una solicitud del cliente y conviértala en una propuesta de software sustentada en investigación, análisis de riesgos y criterio técnico.

Escenario ficticio con requisitos sobredimensionados de forma intencional. No describe sistemas reales. Deberá justificar qué requisitos conserva, modifica o elimina.

# Escenario y solicitud del cliente

Una red de consultorios solicita una aplicación web y móvil para buscar profesionales, reservar consultas y utilizar seguros médicos.

“Queremos que el paciente encuentre un especialista, compruebe su cobertura y pague el copago. Para evitar solicitudes adicionales, pediremos toda su información médica al crear la cuenta. Las aseguradoras y los consultorios deberían poder revisar los datos desde un mismo panel.”

La plataforma atenderá a 40.000 pacientes, 150 profesionales, 20 establecimientos y cinco aseguradoras, con hasta 2.000 usuarios simultáneos.

# Requisitos solicitados

| **ID** | **Categoría**                   | **Requisito solicitado por el cliente**                                                                                                           |
|--------|---------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| S01    | Funciones                       | Buscar especialistas, reservar y cancelar consultas, consultar cobertura y gestionar copagos.                                                     |
| S02    | Datos personales                | Registrar nombres, identificación, fecha de nacimiento, correo y teléfono del paciente.                                                           |
| S03    | Seguro                          | Registrar aseguradora, número de póliza, titular, beneficiario y datos necesarios para verificar cobertura.                                       |
| S04    | Salud                           | Exigir historia clínica completa, diagnósticos, medicamentos, alergias y todos los exámenes previos antes de mostrar horarios.                    |
| S05    | Datos adicionales               | Solicitar ingresos familiares, religión, empleador, ubicación permanente y contactos del teléfono.                                                |
| S06    | Beneficiarios                   | Permitir agregar hijos y otros dependientes mediante su identificación, sin comprobar la representación ni diferenciar edades.                    |
| S07    | Integraciones                   | Intercambiar solicitudes de cobertura, autorizaciones y respuestas con los sistemas de las aseguradoras.                                          |
| S08    | Permisos                        | Permitir que cualquier aseguradora consulte la información de todos los pacientes registrados, tengan o no una póliza con ella.                   |
| S09    | Notificaciones                  | Enviar recordatorios con diagnóstico, especialidad y número de póliza a través de mensajes visibles en la pantalla bloqueada.                     |
| S10    | Sesiones                        | Guardar el token de sesión en un enlace reutilizable que pueda enviarse por mensajería para facilitar el ingreso.                                 |
| S11    | Pagos                           | Almacenar los datos completos de las tarjetas y permitir que recepción los consulte para resolver problemas de cobro.                             |
| S12    | Auditoría                       | Registrar consultas, cambios y transferencias de información utilizando la misma cuenta para todo el personal de cada consultorio.                |
| S13    | Infraestructura y continuidad   | Alojar aplicación, archivos, base de datos y respaldos en un único servidor; prometer disponibilidad continua sin definir recuperación.           |
| S14    | Conservación y usos adicionales | Conservar indefinidamente los expedientes y utilizarlos para publicidad y entrenamiento de IA mediante una aceptación obligatoria al registrarse. |

# Actividad solicitada

Actúe como responsable del diseño seguro. Delimite qué información requiere la reserva, la atención médica, la verificación del seguro y el pago. Analice los accesos y transferencias entre pacientes, profesionales, consultorios, aseguradoras y proveedores. Desarrolle los entregables indicados en las instrucciones siguientes.

# Instrucciones y entregables

## 1 Depuración de requisitos

Analice cada requisito de la tabla y decida si debe conservarse, modificarse o eliminarse. Justifique su decisión y escriba el requisito definitivo. Cuando falte información, formule una pregunta concreta al cliente y declare cualquier supuesto utilizado.

## 2 Análisis de datos

Identifique los datos solicitados, su finalidad, clasificación, necesidad, personas que podrían acceder y plazo de conservación propuesto. Investigue la normativa ecuatoriana vigente y cite las disposiciones que respalden su análisis. No considere que todos los datos son necesarios únicamente porque el cliente los solicita.

## 3 Diseño propuesto

Presente los roles y permisos, componentes principales, integraciones y recorrido de los datos. Justifique la capacidad requerida considerando usuarios simultáneos, operaciones, almacenamiento y disponibilidad. Identifique las mediciones que necesitaría para validar ese dimensionamiento.

## 4 Matriz de riesgos

Utilice tantas filas como riesgos pertinentes identifique. Incluya los siguientes campos: ID y requisito relacionado; activo o dato; amenaza; vulnerabilidad o condición que la permitiría; escenario y consecuencia; propiedad afectada; probabilidad y justificación; impacto y justificación; nivel y prioridad; controles propuestos; verificación del control; riesgo residual estimado. Defina la escala de valoración y el procedimiento para determinar el nivel de riesgo. Diferencie amenaza, vulnerabilidad y consecuencia. Justifique el riesgo residual bajo el supuesto de que los controles se implementen y funcionen.

## 5 Relación con MITRE ATT&CK

Para los escenarios de ataque identificados, investigue las técnicas y subtécnicas pertinentes. Registre identificador, nombre, táctica asociada, relación con el escenario y controles que ayudarían a prevenirlo, detectarlo o responder. Seleccione las que correspondan al análisis; no limite el trabajo a una sola ni fuerce una correspondencia para cada riesgo. Distinga las técnicas del adversario de los controles defensivos.

## 6 Evidencias y fuentes

Explique cómo comprobaría la eficacia de los controles mediante pruebas y resultados esperados. Cite fuentes oficiales para normativa ecuatoriana y documentación técnica primaria para sustentar sus decisiones, incluyendo fecha de consulta.

## Producto final

Propuesta de requisitos corregidos, análisis de datos, diseño general, matriz de riesgos, relación con MITRE ATT&CK y plan de verificación. Cierre con una explicación dirigida al cliente sobre los principales cambios y sus razones.
