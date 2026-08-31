import { Component, computed, signal } from '@angular/core';
import { DataService } from '../../core/data.service';

type ImportKind = 'OFFICIAL_EXAMS' | 'TOPICS' | null;

@Component({
  standalone: true,
  template: `
    <header class="page-title">
      <div>
        <span class="eyebrow">ADMINISTRACIÓN</span>
        <h1>Importación masiva</h1>
        <p>Sube exámenes oficiales o bancos de preguntas por temas desde CSV.</p>
      </div>
    </header>

    <div class="admin-import-layout">
      <section class="panel">
        <div class="import-step">1</div>
        <h2>Selecciona un CSV</h2>
        <p class="muted">
          La plataforma detecta automáticamente si el archivo contiene
          exámenes oficiales o preguntas clasificadas por temas.
        </p>

        <label class="dropzone csv-dropzone">
          <div class="drop-icon">CSV</div>
          <strong>Elegir archivo CSV</strong>
          <span>Exámenes oficiales o banco de preguntas por temas.</span>
          <input
            type="file"
            accept=".csv,text/csv"
            hidden
            (change)="loadCsv($event)">
        </label>

        @if (fileName()) {
          <div class="file-ok">✓ {{ fileName() }}</div>
        }

        @if (kind() === 'TOPICS') {
          <div class="import-type-badge">BANCO POR TEMAS</div>
        }

        @if (kind() === 'OFFICIAL_EXAMS') {
          <div class="import-type-badge">EXÁMENES OFICIALES</div>
        }

        @if (error()) {
          <div class="form-error">{{ error() }}</div>
        }
      </section>

      @if (kind() === 'TOPICS' && topics().length) {
        <section class="panel">
          <div class="import-step">2</div>
          <h2>Preguntas por temas</h2>

          <div class="import-stats">
            <div>
              <strong>{{ topics().length }}</strong>
              <span>Temas detectados</span>
            </div>
            <div>
              <strong>{{ totalQuestions() }}</strong>
              <span>Preguntas detectadas</span>
            </div>
          </div>

          <div class="detected-exams">
            @for (topic of topics(); track topic.topic_number) {
              <div class="detected-row">
                <div>
                  <strong>Tema {{ topic.topic_number }}</strong>
                  <span>{{ topic.topic_name }}</span>
                </div>
                <div class="detected-count">
                  {{ topic.questions.length }} preguntas
                </div>
              </div>
            }
          </div>

          <p class="topic-import-note">
            Estas preguntas se guardarán con su <strong>topic_id</strong>.
            Por tanto aparecerán en Crear test personalizado, Ver tests,
            progreso del tema y estadísticas.
          </p>

          <button
            class="btn primary wide import-all-btn"
            (click)="importTopics()"
            [disabled]="importing()">
            {{ importing()
              ? 'IMPORTANDO...'
              : 'IMPORTAR ' + totalQuestions() + ' PREGUNTAS' }}
          </button>

          @if (success()) {
            <div class="form-info">{{ success() }}</div>
          }
        </section>
      }

      @if (kind() === 'OFFICIAL_EXAMS' && exams().length) {
        <section class="panel">
          <div class="import-step">2</div>
          <h2>Exámenes oficiales</h2>

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
            (click)="importExams()"
            [disabled]="importing()">
            {{ importing()
              ? 'IMPORTANDO...'
              : 'IMPORTAR ' + exams().length + ' EXÁMENES' }}
          </button>

          @if (success()) {
            <div class="form-info">{{ success() }}</div>
          }
        </section>
      }
    </div>

    <section class="panel csv-format-help">
      <h2>Formatos admitidos</h2>

      <p><strong>Preguntas por temas:</strong></p>
      <div class="csv-columns">
        <code>topic_number</code>
        <code>topic_name</code>
        <code>question_number</code>
        <code>position</code>
        <code>statement</code>
        <code>option_a</code>
        <code>option_b</code>
        <code>option_c</code>
        <code>option_d</code>
        <code>correct_option</code>
      </div>

      <p><strong>Exámenes oficiales:</strong></p>
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
    </section>
  `
})
export class AdminImportComponent {
  kind = signal<ImportKind>(null);
  topics = signal<any[]>([]);
  exams = signal<any[]>([]);
  fileName = signal('');
  error = signal('');
  success = signal('');
  importing = signal(false);

  totalQuestions = computed(() => {
    if (this.kind() === 'TOPICS') {
      return this.topics().reduce(
        (sum, topic) => sum + topic.questions.length,
        0
      );
    }

    return this.exams().reduce(
      (sum, exam) => sum + exam.questions.length,
      0
    );
  });

  constructor(private data: DataService) {}

  async loadCsv(event: Event) {
    this.kind.set(null);
    this.topics.set([]);
    this.exams.set([]);
    this.error.set('');
    this.success.set('');

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.fileName.set(file.name);

    try {
      const text = await file.text();
      const firstLine = text
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/, 1)[0]
        .toLowerCase();

      if (firstLine.includes('topic_number')) {
        const groups = this.data.parseTopicCsv(text);

        if (!groups.length) {
          throw new Error('No se han detectado preguntas de temas válidas.');
        }

        this.kind.set('TOPICS');
        this.topics.set(groups);
        return;
      }

      if (firstLine.includes('exam_name')) {
        const exams = this.data.parseOfficialCsv(text);

        if (!exams.length) {
          throw new Error('No se ha detectado ningún examen oficial válido.');
        }

        this.kind.set('OFFICIAL_EXAMS');
        this.exams.set(exams);
        return;
      }

      throw new Error(
        'Formato CSV no reconocido. Debe contener topic_number o exam_name.'
      );
    } catch (e: any) {
      this.error.set(e?.message ?? 'No se pudo procesar el CSV.');
    }
  }

  async importTopics() {
    if (!this.topics().length) return;

    if (!confirm(
      `Se van a importar ${this.totalQuestions()} preguntas clasificadas en ` +
      `${this.topics().length} temas. ¿Continuar?`
    )) return;

    this.importing.set(true);
    this.error.set('');
    this.success.set('');

    try {
      const result = await this.data.importTopicCsvGroups(this.topics());

      this.success.set(
        `✓ Importación completada: ${result.importedQuestions} preguntas nuevas. ` +
        `${result.skippedQuestions} duplicadas omitidas.`
      );
    } catch (e: any) {
      this.error.set(e?.message ?? 'Error durante la importación por temas.');
    } finally {
      this.importing.set(false);
    }
  }

  async importExams() {
    if (!this.exams().length) return;

    if (!confirm(
      `Se van a importar ${this.exams().length} exámenes y ` +
      `${this.totalQuestions()} preguntas. ¿Continuar?`
    )) return;

    this.importing.set(true);
    this.error.set('');
    this.success.set('');

    try {
      const result = await this.data.importOfficialCsvExams(this.exams());

      const skippedText = result.skipped.length
        ? ` ${result.skipped.length} exámenes ya existían y se han omitido.`
        : '';

      this.success.set(
        `✓ Importación completada: ${result.importedExams} exámenes y ` +
        `${result.importedQuestions} preguntas.${skippedText}`
      );
    } catch (e: any) {
      this.error.set(e?.message ?? 'Error durante la importación de exámenes.');
    } finally {
      this.importing.set(false);
    }
  }
}
