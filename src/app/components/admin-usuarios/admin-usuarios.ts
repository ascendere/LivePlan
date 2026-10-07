import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ExcelExportService } from '../../core/services/excel-export.service';
import {
  EstadoCarga,
  FilaCarga,
  RespuestaCarga,
  UsuarioAdmin,
  UsuariosAdminService,
} from '../../core/services/usuarios-admin.service';
import { leerArchivoTabla } from '../../core/utils/leer-tabla';

type ModoAgregar = 'manual' | 'masiva';

interface Confirmacion {
  accion: 'deshabilitar' | 'habilitar' | 'formatear';
  usuario: UsuarioAdmin;
}

/** Columnas del archivo y los nombres con que se aceptan en el encabezado (sin tildes ni símbolos). */
const COLUMNAS: { campo: keyof FilaCarga; etiqueta: string; alias: string[]; opcional?: boolean }[] = [
  { campo: 'nombres', etiqueta: 'Nombres', alias: ['nombres', 'nombre'] },
  { campo: 'apellidos', etiqueta: 'Apellidos', alias: ['apellidos', 'apellido'] },
  { campo: 'correo', etiqueta: 'Correo', alias: ['correo', 'email', 'correoelectronico', 'mail', 'correoinstitucional'] },
  { campo: 'cedula', etiqueta: 'Cédula', alias: ['cedula', 'cedulaidentidad', 'identificacion', 'ci', 'documento', 'pasaporte'] },
  // Opcional: sin esta columna (o vacía) todos son cédulas ecuatorianas.
  {
    campo: 'tipo_documento',
    etiqueta: 'Tipo de documento',
    alias: ['tipodocumento', 'tipodedocumento', 'tipoidentificacion', 'tipodeidentificacion', 'tipoid', 'tipodoc'],
    opcional: true,
  },
  { campo: 'carrera', etiqueta: 'Carrera', alias: ['carrera', 'programa'] },
  { campo: 'asignatura', etiqueta: 'Asignatura', alias: ['asignatura', 'materia', 'curso'] },
];

const normalizarEncabezado = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

@Component({
  selector: 'app-admin-usuarios',
  templateUrl: './admin-usuarios.html',
  styleUrls: ['./admin-usuarios.css'],
  standalone: false,
})
export class AdminUsuarios implements OnInit, OnDestroy {
  // ---- ventana "Agregar usuarios" ----
  modalAbierto = false;
  modo: ModoAgregar = 'manual';
  /** Se creó o cambió algo con la ventana abierta: al cerrarla se recarga la lista. */
  hayCambios = false;

  // ---- ingreso manual ----
  manual: FilaCarga = this.filaVacia();
  guardandoManual = false;
  errorManual = '';
  avisoManual = '';

  // ---- lista ----
  usuarios: UsuarioAdmin[] = [];
  total = 0;
  pagina = 1;
  readonly porPagina = 25;
  busqueda = '';
  cargandoLista = false;
  errorLista = '';
  private temporizadorBusqueda?: ReturnType<typeof setTimeout>;
  accionEnCurso: number | null = null;
  mensajeAccion = '';
  errorAccion = '';
  confirmacion: Confirmacion | null = null;

  // ---- carga masiva ----
  archivoNombre = '';
  filas: FilaCarga[] = [];
  /** Número de fila del archivo (como lo ve la persona en Excel) de cada fila de `filas`. */
  filasEnArchivo: number[] = [];
  vista: RespuestaCarga | null = null;
  errorCarga = '';
  leyendo = false;
  cargando = false;
  resultadoFinal: RespuestaCarga | null = null;
  readonly columnas = COLUMNAS;

  constructor(
    private readonly servicio: UsuariosAdminService,
    private readonly excel: ExcelExportService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.cargarLista();
  }

  ngOnDestroy(): void {
    clearTimeout(this.temporizadorBusqueda);
  }

  private filaVacia(): FilaCarga {
    return { nombres: '', apellidos: '', correo: '', cedula: '', tipo_documento: 'cedula', carrera: '', asignatura: '' };
  }

  // ============================================================ ventana "Agregar usuarios"

  abrirModal(modo: ModoAgregar = 'manual'): void {
    this.modo = modo;
    this.modalAbierto = true;
    this.hayCambios = false;
    this.errorManual = '';
    this.avisoManual = '';
  }

  cerrarModal(): void {
    if (this.cargando || this.guardandoManual) return;
    this.modalAbierto = false;
    this.reiniciarCarga();
    this.manual = this.filaVacia();
    if (this.hayCambios) {
      this.pagina = 1;
      this.busqueda = '';
      this.cargarLista();
    }
  }

  cambiarModo(modo: ModoAgregar): void {
    if (this.cargando || this.guardandoManual) return;
    this.modo = modo;
  }

  // ---- ingreso manual ----

  get manualCompleto(): boolean {
    return Object.values(this.manual).every((v) => v.trim() !== ''); // el tipo de documento ya trae un valor
  }

  /** Manda una sola fila al mismo servicio de la carga masiva: la limpieza y las validaciones son las mismas. */
  async guardarManual(): Promise<void> {
    if (!this.manualCompleto || this.guardandoManual) return;
    this.guardandoManual = true;
    this.errorManual = '';
    this.avisoManual = '';
    try {
      const r = await this.servicio.cargar([this.manual], false);
      const resultado = r.resultados[0];
      if (!resultado || resultado.estado === 'error') {
        this.errorManual = resultado?.mensaje ?? 'No se pudo guardar el usuario.';
        return;
      }
      this.hayCambios = true;
      this.avisoManual = this.mensajeManual(resultado.estado, this.manual);
      // se conservan carrera y asignatura: lo normal es dar de alta a varias personas del mismo curso
      this.manual = { ...this.filaVacia(), carrera: this.manual.carrera, asignatura: this.manual.asignatura };
    } catch (e: any) {
      this.errorManual = e?.message ?? 'No se pudo guardar el usuario.';
    } finally {
      this.guardandoManual = false;
      this.cdr.markForCheck();
    }
  }

  private mensajeManual(estado: EstadoCarga, f: FilaCarga): string {
    const quien = `${f.nombres.trim()} ${f.apellidos.trim()}`;
    switch (estado) {
      case 'creado':
        return `${quien} fue agregado. Su contraseña inicial es su cédula y deberá cambiarla al ingresar.`;
      case 'vinculado':
        return `${quien} ya tenía cuenta; se enlazó con sus datos y conserva su contraseña.`;
      case 'actualizado':
        return `${quien} ya estaba en la lista; se le agregó la nueva asignatura.`;
      default:
        return `${quien} ya estaba en la lista con esa asignatura; no hubo cambios.`;
    }
  }

  // ============================================================ lista

  async cargarLista(): Promise<void> {
    this.cargandoLista = true;
    this.errorLista = '';
    try {
      const r = await this.servicio.listar(this.busqueda, this.pagina, this.porPagina);
      this.usuarios = r.usuarios;
      this.total = r.total;
    } catch (e: any) {
      this.errorLista = e?.message ?? 'No se pudo cargar la lista.';
    } finally {
      this.cargandoLista = false;
      this.cdr.markForCheck();
    }
  }

  alBuscar(): void {
    clearTimeout(this.temporizadorBusqueda);
    this.temporizadorBusqueda = setTimeout(() => {
      this.pagina = 1;
      this.cargarLista();
    }, 300);
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.total / this.porPagina));
  }

  irAPagina(p: number): void {
    if (p < 1 || p > this.totalPaginas || p === this.pagina) return;
    this.pagina = p;
    this.cargarLista();
  }

  nombreCompleto(u: UsuarioAdmin): string {
    return `${u.apellidos} ${u.nombres}`;
  }

  // ---- acciones por usuario ----

  pedirConfirmacion(accion: Confirmacion['accion'], usuario: UsuarioAdmin): void {
    this.mensajeAccion = '';
    this.errorAccion = '';
    this.confirmacion = { accion, usuario };
  }

  cancelarConfirmacion(): void {
    this.confirmacion = null;
  }

  textoConfirmacion(c: Confirmacion): string {
    const nombre = this.nombreCompleto(c.usuario);
    switch (c.accion) {
      case 'deshabilitar':
        return `${nombre} no podrá iniciar sesión y se cerrarán sus sesiones abiertas. Sus planes se conservan.`;
      case 'habilitar':
        return `${nombre} podrá volver a iniciar sesión con su contraseña actual.`;
      case 'formatear':
        return `La contraseña de ${nombre} volverá a ser su cédula y tendrá que elegir una nueva al ingresar. Sus sesiones abiertas se cerrarán.`;
    }
  }

  tituloConfirmacion(c: Confirmacion): string {
    return { deshabilitar: 'Deshabilitar usuario', habilitar: 'Habilitar usuario', formatear: 'Formatear contraseña' }[c.accion];
  }

  async confirmarAccion(): Promise<void> {
    const c = this.confirmacion;
    if (!c) return;
    this.confirmacion = null;
    this.accionEnCurso = c.usuario.id;
    this.mensajeAccion = '';
    this.errorAccion = '';
    try {
      if (c.accion === 'formatear') {
        await this.servicio.formatearClave(c.usuario.id);
        this.mensajeAccion = `Contraseña de ${this.nombreCompleto(c.usuario)} restablecida a su cédula.`;
      } else {
        const actualizado = await this.servicio.cambiarActivo(c.usuario.id, c.accion === 'habilitar');
        this.usuarios = this.usuarios.map((u) => (u.id === actualizado.id ? { ...u, activo: actualizado.activo } : u));
        this.mensajeAccion = `${this.nombreCompleto(c.usuario)} fue ${actualizado.activo ? 'habilitado' : 'deshabilitado'}.`;
      }
    } catch (e: any) {
      this.errorAccion = e?.message ?? 'No se pudo completar la acción.';
    } finally {
      this.accionEnCurso = null;
      this.cdr.markForCheck();
    }
  }

  // ============================================================ carga masiva

  descargarPlantilla(): void {
    const encabezado = COLUMNAS.map((c) => ({ v: c.etiqueta, encabezado: true }));
    // orden de COLUMNAS: nombres, apellidos, correo, cédula, tipo de documento, carrera, asignatura
    const ejemplos = [
      ['Ana María', 'Pérez Loor', 'ampe@utpl.edu.ec', '1712345675', 'Cédula', 'Ingeniería de Software', 'Cálculo I'],
      ['John', 'Smith', 'jsmith@gmail.com', 'AB123456', 'Pasaporte', 'Ingeniería de Software', 'Cálculo I'],
    ].map((fila) => fila.map((v) => ({ v })));
    this.excel.descargar('plantilla-usuarios', [{ nombre: 'Usuarios', filas: [encabezado, ...ejemplos] }]);
  }

  async alElegirArchivo(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = ''; // permite volver a elegir el mismo archivo
    if (!archivo) return;
    this.reiniciarCarga();
    this.archivoNombre = archivo.name;
    this.leyendo = true;
    try {
      const tabla = await leerArchivoTabla(archivo);
      this.interpretarTabla(tabla);
      if (this.filas.length > 0) {
        this.vista = await this.servicio.cargar(this.filas, true);
      }
    } catch (e: any) {
      this.errorCarga = e?.message ?? 'No se pudo leer el archivo.';
    } finally {
      this.leyendo = false;
      this.cdr.markForCheck();
    }
  }

  private reiniciarCarga(): void {
    this.filas = [];
    this.filasEnArchivo = [];
    this.vista = null;
    this.resultadoFinal = null;
    this.errorCarga = '';
    this.archivoNombre = '';
  }

  /** Busca el encabezado, ubica las 6 columnas por nombre y arma las filas (saltando las vacías). */
  private interpretarTabla(tabla: string[][]): void {
    const filaEncabezado = tabla.findIndex((f) => f.some((c) => (c ?? '').trim() !== ''));
    if (filaEncabezado < 0) throw new Error('El archivo está vacío.');

    const indices = new Map<keyof FilaCarga, number>();
    tabla[filaEncabezado].forEach((texto, i) => {
      const n = normalizarEncabezado(texto ?? '');
      const columna = COLUMNAS.find((c) => c.alias.includes(n));
      if (columna && !indices.has(columna.campo)) indices.set(columna.campo, i);
    });
    const faltan = COLUMNAS.filter((c) => !c.opcional && !indices.has(c.campo)).map((c) => c.etiqueta);
    if (faltan.length > 0) {
      throw new Error(`Faltan columnas en el encabezado: ${faltan.join(', ')}. Descarga la plantilla para ver el formato.`);
    }

    for (let i = filaEncabezado + 1; i < tabla.length; i++) {
      const fila = tabla[i] ?? [];
      const valores = {} as FilaCarga;
      for (const c of COLUMNAS) {
        const columna = indices.get(c.campo);
        valores[c.campo] = columna === undefined ? '' : String(fila[columna] ?? '');
      }
      if (Object.values(valores).every((v) => v.trim() === '')) continue; // fila en blanco
      this.filas.push(valores);
      this.filasEnArchivo.push(i + 1);
    }
    if (this.filas.length === 0) throw new Error('El archivo no tiene filas con datos debajo del encabezado.');
  }

  /** "Filas 3, 5" del archivo para un resultado del backend (que numera desde 1 las filas enviadas). */
  filasDelResultado(r: { fila: number; filas?: number[] }): string {
    const enviadas = r.filas?.length ? r.filas : [r.fila];
    const enArchivo = enviadas.map((n) => this.filasEnArchivo[n - 1] ?? n);
    return enArchivo.join(', ');
  }

  etiquetaEstado(estado: EstadoCarga, simulado: boolean): string {
    const futuro: Record<EstadoCarga, string> = {
      creado: 'Se creará',
      vinculado: 'Se vinculará',
      actualizado: 'Se actualizará',
      sin_cambios: 'Sin cambios',
      error: 'Error',
    };
    const pasado: Record<EstadoCarga, string> = {
      creado: 'Creado',
      vinculado: 'Vinculado',
      actualizado: 'Actualizado',
      sin_cambios: 'Sin cambios',
      error: 'Error',
    };
    return (simulado ? futuro : pasado)[estado];
  }

  cuenta(r: RespuestaCarga | null, estado: EstadoCarga): number {
    return r?.resumen?.[estado] ?? 0;
  }

  get hayAlgoQueCargar(): boolean {
    const r = this.vista;
    return this.cuenta(r, 'creado') + this.cuenta(r, 'vinculado') + this.cuenta(r, 'actualizado') > 0;
  }

  async confirmarCarga(): Promise<void> {
    if (!this.hayAlgoQueCargar || this.cargando) return;
    this.cargando = true;
    this.errorCarga = '';
    try {
      this.resultadoFinal = await this.servicio.cargar(this.filas, false);
      this.vista = null;
      this.hayCambios = true;
    } catch (e: any) {
      this.errorCarga = e?.message ?? 'No se pudo completar la carga.';
    } finally {
      this.cargando = false;
      this.cdr.markForCheck();
    }
  }

  nuevaCarga(): void {
    this.reiniciarCarga();
  }

  /** Termina la carga masiva: cierra la ventana y muestra la lista actualizada. */
  irALista(): void {
    this.hayCambios = true;
    this.cerrarModal();
  }
}
