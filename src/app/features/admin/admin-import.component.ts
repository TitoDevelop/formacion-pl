import { Component, computed, signal } from '@angular/core';
import { DataService } from '../../core/data.service';

@Component({
  standalone: true,
  template: `
    <header class="page-title">
      <div>
        <span class="eyebrow">ADMINISTRACIÓN</span>
        <h1>Importar exámenes oficiales</h1>
        <p>Importa uno o varios exámenes desde un único CSV.</p>
      </div>
    </header>

    <div class="admin-import-layout">
      <section class="panel">
        <div class="import-step">1</div>
        <h2>Selecciona un CSV</h2>
        <p class="muted">
          El archivo puede contener muchos municipios y años. La plataforma los agrupa automáticamente.
        </p>

        <label class="dropzone csv-dropzone">
          <div class="drop-icon">CSV</div>
          <strong>Elegir archivo CSV</strong>
          <span>También puedes arrastrarlo aquí desde tu equipo.</span>
          <input
            type="file"
            accept=".csv,text/csv"
            hidden
            (change)="loadCsv($event)">
        </label>

        @if (fileName()) {
          <div class="file-ok">
            ✓ {{ fileName() }}
          </div>
        }

        @if (error()) {
          <div class="form-error">{{ error() }}</div>
        }
      </section>

      @if (exams().length) {
        <section class="panel">
          <div class="import-step">2</div>
          <h2>Resumen de importación</h2>

          <div class="import-stats">
            <div>
              <strong>{{ exams().length }}</strong>
              <span>Exámenes detectados</span>
            </div>
            <div>
              <strong>{{ totalQuestions() }}</strong>
              <span>Preguntas detectadas</span>
            </div>
          </div>

          <div class="detected-exams">
            @for (exam of exams(); track exam.exam_name) {
              <div class="detected-row">
                <div>
                  <strong>{{ exam.exam_name }}</strong>
                  <span>{{ exam.municipality }} · {{ exam.year }}</span>
                </div>
                <div class="detected-count">
                  {{ exam.questions.length }} preguntas
                </div>
              </div>
            }
          </div>

          <button
            class="btn primary wide import-all-btn"
            (click)="importAll()"
            [disabled]="importing()">
            {{ importing()
              ? 'IMPORTANDO...'
              : 'IMPORTAR ' + exams().length + ' EXÁMENES' }}
          </button>

          @if (progress()) {
            <div class="import-progress">{{ progress() }}</div>
          }

          @if (success()) {
            <div class="form-info">{{ success() }}</div>
          }
        </section>
      }
    </div>

    <section class="panel csv-format-help">
      <h2>Formato CSV esperado</h2>
      <p>
        Cada fila representa una pregunta. Las preguntas con el mismo
        <strong>exam_name + municipality + year</strong> se agrupan como un examen.
      </p>

      <div class="csv-columns">
        <code>exam_name</code>
        <code>municipality</code>
        <code>year</code>
        <code>question_number</code>
        <code>position</code>
        <code>statement</code>
        <code>option_a</code>
        <code>option_b</code>
        <code>option_c</code>
        <code>option_d</code>
        <code>correct_option</code>
      </div>

      <p class="muted">
        También admite opcionalmente <code>correct_text</code> y <code>source_id</code>.
      </p>
    </section>
  `
})
export class AdminImportComponent {
  exams = signal<any[]>([]);
  fileName = signal('');
  error = signal('');
  success = signal('');
  progress = signal('');
  importing = signal(false);

  totalQuestions = computed(() =>
    this.exams().reduce((sum, exam) => sum + exam.questions.length, 0)
  );

  constructor(private data: DataService) {}

  async loadCsv(event: Event) {
    this.error.set('');
    this.success.set('');
    this.progress.set('');
    this.exams.set([]);

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.fileName.set(file.name);

    try {
      const parsed = this.data.parseOfficialCsv(await file.text());

      if (!parsed.length) {
        throw new Error('No se ha detectado ningún examen válido en el CSV.');
      }

      this.exams.set(parsed);
    } catch (e: any) {
      this.error.set(e?.message ?? 'No se pudo procesar el CSV.');
    }
  }

  async importAll() {
    if (!this.exams().length) return;

    if (!confirm(
      `Se van a importar ${this.exams().length} exámenes y ${this.totalQuestions()} preguntas. ¿Continuar?`
    )) {
      return;
    }

    this.importing.set(true);
    this.error.set('');
    this.success.set('');
    this.progress.set('Procesando exámenes y preguntas en Supabase...');

    try {
      const result = await this.data.importOfficialCsvExams(this.exams());

      const skippedText = result.skipped.length
        ? ` ${result.skipped.length} exámenes ya existían y se han omitido.`
        : '';

      this.success.set(
        `✓ Importación completada: ${result.importedExams} exámenes y ` +
        `${result.importedQuestions} preguntas importadas.${skippedText}`
      );

      this.progress.set('');
    } catch (e: any) {
      this.error.set(e?.message ?? 'Error durante la importación.');
      this.progress.set('');
    } finally {
      this.importing.set(false);
    }
  }
}
