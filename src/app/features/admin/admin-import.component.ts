import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/data.service';
import { ImportGroup } from '../../core/models';

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <header class="page-title">
      <div><span class="eyebrow">ADMINISTRACIÓN</span><h1>Importar examen oficial</h1><p>Lee directamente el JSON interno del HTML universal.</p></div>
    </header>

    <div class="admin-grid">
      <section class="panel">
        <h2>1. Selecciona el HTML universal</h2>
        <label class="dropzone">
          <strong>Elegir Banco_Universal_PL_CV.html</strong>
          <span>El archivo se procesa en tu navegador.</span>
          <input type="file" accept=".html,text/html" hidden (change)="loadFile($event)">
        </label>

        @if (fileName()) {
          <div class="file-ok">✓ {{ fileName() }} · {{ groups().length }} grupos municipio/año detectados</div>
        }
        @if (error()) { <div class="form-error">{{ error() }}</div> }
      </section>

      @if (groups().length) {
        <section class="panel">
          <h2>2. Elige qué importar</h2>

          <label>Municipio y año</label>
          <select [ngModel]="selectedKey()" (ngModelChange)="selectedKey.set($event)">
            @for (group of groups(); track key(group)) {
              <option [value]="key(group)">{{ group.municipality }} · {{ group.year }} ({{ group.questions.length }} preguntas)</option>
            }
          </select>

          <label>Límite para esta prueba</label>
          <input type="number" min="1" max="300" [(ngModel)]="limit">
          <p class="help">Recomendación inicial: 20 preguntas. Después puedes importar el examen completo.</p>

          @if (selectedGroup(); as group) {
            <div class="import-summary">
              <strong>{{ group.municipality }} · {{ group.year }}</strong>
              <span>Se importarán {{ effectiveLimit() }} de {{ group.questions.length }} preguntas.</span>
            </div>

            <h3>Previsualización</h3>
            @for (q of group.questions.slice(0, 5); track q.id) {
              <div class="preview-q">
                <strong>P{{ q.n }}. {{ q.e }}</strong>
                <small>Correcta: {{ q.c }}</small>
              </div>
            }

            <button class="btn primary wide" (click)="importSelected()" [disabled]="importing()">
              {{ importing() ? 'Importando…' : 'IMPORTAR EN SUPABASE' }}
            </button>
          }

          @if (success()) { <div class="form-info">{{ success() }}</div> }
        </section>
      }
    </div>
  `
})
export class AdminImportComponent {
  groups = signal<ImportGroup[]>([]);
  selectedKey = signal('');
  fileName = signal('');
  error = signal('');
  success = signal('');
  importing = signal(false);
  limit = 20;

  selectedGroup = computed(() => this.groups().find(g => this.key(g) === this.selectedKey()) ?? this.groups()[0] ?? null);
  effectiveLimit = computed(() => Math.min(Math.max(1, Number(this.limit) || 20), this.selectedGroup()?.questions.length ?? 0));

  constructor(private data: DataService) {}

  async loadFile(event: Event) {
    this.error.set('');
    this.success.set('');
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.fileName.set(file.name);
    try {
      const groups = this.data.parseUniversalHtml(await file.text());
      this.groups.set(groups);
      if (groups.length) this.selectedKey.set(this.key(groups[0]));
    } catch (e: any) {
      this.error.set(e?.message ?? 'No se pudo procesar el HTML.');
    }
  }

  key(g: ImportGroup) { return `${g.municipality}|||${g.year}`; }

  async importSelected() {
    const group = this.selectedGroup();
    if (!group) return;
    this.importing.set(true);
    this.error.set('');
    this.success.set('');
    try {
      await this.data.importOfficialGroup(group, this.effectiveLimit());
      this.success.set(`✓ Importado ${group.municipality} ${group.year} con ${this.effectiveLimit()} preguntas. Ya aparece en Exámenes oficiales.`);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Error durante la importación.');
    } finally {
      this.importing.set(false);
    }
  }
}
