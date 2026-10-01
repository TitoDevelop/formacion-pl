import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/data.service';
import { AdminTopicQuestionStats, AdminTopicQuestionUpdate, Question, QuestionIssue, QuestionIssueStatus } from '../../core/models';

type AdminQuestionTab = 'maintenance' | 'issues';
type AdminIssueFilter = QuestionIssueStatus | 'all';

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <header class="page-title">
      <div>
        <span class="eyebrow">ADMINISTRACION</span>
        <h1>Mantenimiento preguntas</h1>
        <p>Edita y elimina preguntas importadas por tema.</p>
      </div>
      <div class="page-actions">
        <button class="btn" (click)="loadTopics()" [disabled]="loadingTopics()">
          {{ loadingTopics() ? 'Cargando...' : 'Recargar' }}
        </button>
      </div>
    </header>

    @if (error()) { <div class="form-error">{{ error() }}</div> }
    @if (success()) { <div class="form-info">{{ success() }}</div> }

    <div class="test-library-tabs admin-question-tabs">
      <button type="button" [class.active]="activeTab() === 'maintenance'" (click)="activeTab.set('maintenance')">
        Mantenimiento
      </button>
      <button type="button" [class.active]="activeTab() === 'issues'" (click)="showIssues()">
        Revision de errores
      </button>
    </div>

    @if (activeTab() === 'maintenance') {
    <div class="topic-question-admin-layout">
      <section class="panel topic-admin-list-panel">
        <div class="panel-head">
          <div>
            <h2>Temas</h2>
            <p>{{ filteredTopics().length }} visibles</p>
          </div>
        </div>

        <input
          class="search-input"
          placeholder="Buscar tema..."
          [ngModel]="topicSearch()"
          (ngModelChange)="topicSearch.set($event)">

        <div class="topic-admin-list">
          @if (loadingTopics()) {
            <div class="empty-state">Cargando temas...</div>
          } @else {
            @for (topic of filteredTopics(); track topic.id) {
              <button
                type="button"
                class="topic-admin-row"
                [class.selected]="selectedTopic()?.id === topic.id"
                (click)="selectTopic(topic)">
                <span class="topic-number">{{ topic.number ?? '-' }}</span>
                <span>
                  <strong>{{ topic.name }}</strong>
                  <small>{{ topic.question_count }} preguntas</small>
                </span>
              </button>
            } @empty {
              <div class="empty-state">No hay temas con esa busqueda.</div>
            }
          }
        </div>
      </section>

      <section class="panel topic-admin-questions-panel">
        @if (!selectedTopic()) {
          <div class="empty-state">Selecciona un tema para ver sus preguntas.</div>
        } @else {
          <div class="panel-head topic-question-head">
            <div>
              <h2>Tema {{ selectedTopic()?.number }} - {{ selectedTopic()?.name }}</h2>
              <p>{{ questions().length }} preguntas en el tema</p>
            </div>
            <button
              class="btn danger-btn"
              [disabled]="loadingQuestions() || !questions().length"
              (click)="deleteTopicQuestions()">
              Eliminar bloque
            </button>
          </div>

          <div class="admin-toolbar">
            <input
              class="search-input"
              placeholder="Buscar en enunciado, opciones o referencia..."
              [ngModel]="questionSearch()"
              (ngModelChange)="setQuestionSearch($event)">
          </div>

          @if (loadingQuestions()) {
            <div class="empty-state">Cargando preguntas...</div>
          } @else {
            <div class="topic-question-list">
              @for (question of pagedQuestions(); track question.id) {
                <article class="topic-question-admin-card">
                  <div class="topic-question-admin-card-head">
                    <div>
                      <strong>{{ question.statement }}</strong>
                      @if (question.source_reference) {
                        <small>{{ question.source_reference }}</small>
                      }
                    </div>
                    <div class="topic-question-actions">
                      <button class="btn" (click)="startEdit(question)">
                        {{ editingId() === question.id ? 'Cerrar' : 'Editar' }}
                      </button>
                      <button class="btn danger-btn" (click)="deleteQuestion(question)">Eliminar</button>
                    </div>
                  </div>

                  @if (editingId() === question.id && editModel()) {
                    <div class="question-edit-form">
                      <label>Enunciado</label>
                      <textarea
                        rows="3"
                        [ngModel]="editModel()!.statement"
                        (ngModelChange)="patchEdit({ statement: $event })"></textarea>

                      <label>Explicacion</label>
                      <textarea
                        rows="2"
                        [ngModel]="editModel()!.explanation"
                        (ngModelChange)="patchEdit({ explanation: $event })"></textarea>

                      <label>Referencia</label>
                      <input
                        [ngModel]="editModel()!.source_reference"
                        (ngModelChange)="patchEdit({ source_reference: $event })">

                      <div class="question-options-editor">
                        @for (option of editModel()!.options; track option.id; let i = $index) {
                          <div class="question-option-editor">
                            <button
                              type="button"
                              class="correct-toggle"
                              [class.active]="option.is_correct"
                              title="Marcar como correcta"
                              (click)="markCorrect(option.id)">
                              {{ optionLetter(i) }}
                            </button>
                            <input
                              [ngModel]="option.text"
                              (ngModelChange)="patchOption(option.id, $event)">
                          </div>
                        }
                      </div>

                      <div class="question-edit-actions">
                        <button class="btn primary" [disabled]="saving()" (click)="saveEdit(question.id)">
                          {{ saving() ? 'Guardando...' : 'Guardar cambios' }}
                        </button>
                        <button class="btn" [disabled]="saving()" (click)="cancelEdit()">Cancelar</button>
                      </div>
                    </div>
                  } @else {
                    <div class="question-option-preview">
                      @for (option of sortedOptions(question); track option.id; let i = $index) {
                        <span [class.correct]="option.is_correct">
                          {{ optionLetter(i) }}. {{ option.text }}
                        </span>
                      }
                    </div>
                  }
                </article>
              } @empty {
                <div class="empty-state">No hay preguntas con los filtros actuales.</div>
              }
            </div>

            @if (totalPages() > 1) {
              <div class="pager">
                <button class="btn" [disabled]="page() === 1" (click)="previousPage()">Anterior</button>
                <span>Pagina {{ page() }} de {{ totalPages() }}</span>
                <button class="btn" [disabled]="page() === totalPages()" (click)="nextPage()">Siguiente</button>
              </div>
            }
          }
        }
      </section>
    </div>
    } @else {
      <section class="panel">
        <div class="panel-head issue-admin-head">
          <div>
            <h2>Revision de errores</h2>
            <p>{{ issues().length }} avisos cargados</p>
          </div>
          <div class="issue-admin-actions">
            <select
              class="official-filter-select"
              [ngModel]="issueStatusFilter()"
              (ngModelChange)="changeIssueFilter($event)">
              <option value="OPEN">Pendientes</option>
              <option value="RESOLVED">Solucionados</option>
              <option value="all">Todos</option>
            </select>
            <button class="btn" type="button" [disabled]="loadingIssues()" (click)="loadIssues()">
              {{ loadingIssues() ? 'Cargando...' : 'Recargar' }}
            </button>
          </div>
        </div>

        @if (loadingIssues()) {
          <div class="empty-state">Cargando avisos...</div>
        } @else {
          <div class="issue-admin-list">
            @for (issue of issues(); track issue.id) {
              <article class="issue-admin-card" [class.resolved]="issue.status === 'RESOLVED'">
                <div class="issue-admin-card-head">
                  <div>
                    <span class="issue-status" [class.resolved]="issue.status === 'RESOLVED'">
                      {{ issue.status === 'RESOLVED' ? 'Solucionado' : 'Pendiente' }}
                    </span>
                    <strong>{{ issue.questions?.statement || 'Pregunta eliminada' }}</strong>
                    <small>
                      {{ formatProfileName(issue.profiles) }} - {{ formatDate(issue.created_at) }}
                      @if (issue.questions?.source_reference) { · {{ issue.questions?.source_reference }} }
                    </small>
                  </div>
                  <div class="topic-question-actions">
                    @if (issue.questions?.topic_id) {
                      <button class="btn" type="button" (click)="openIssueQuestion(issue)">Abrir pregunta</button>
                    }
                    @if (issue.status === 'OPEN') {
                      <button class="btn success-btn" type="button" [disabled]="saving()" (click)="setIssueStatus(issue, 'RESOLVED')">
                        Marcar solucionado
                      </button>
                    } @else {
                      <button class="btn" type="button" [disabled]="saving()" (click)="setIssueStatus(issue, 'OPEN')">
                        Reabrir
                      </button>
                    }
                  </div>
                </div>

                <p class="issue-message">{{ issue.message }}</p>

                @if (issue.questions) {
                  <div class="question-option-preview">
                    @for (option of sortedOptions(issue.questions); track option.id; let i = $index) {
                      <span [class.correct]="option.is_correct">
                        {{ optionLetter(i) }}. {{ option.text }}
                      </span>
                    }
                  </div>
                }
              </article>
            } @empty {
              <div class="empty-state">No hay avisos con este filtro.</div>
            }
          </div>
        }
      </section>
    }
  `
})
export class AdminTopicQuestionsComponent implements OnInit {
  activeTab = signal<AdminQuestionTab>('maintenance');
  topics = signal<AdminTopicQuestionStats[]>([]);
  selectedTopic = signal<AdminTopicQuestionStats | null>(null);
  questions = signal<Question[]>([]);
  issues = signal<QuestionIssue[]>([]);
  issueStatusFilter = signal<AdminIssueFilter>('OPEN');
  topicSearch = signal('');
  questionSearch = signal('');
  page = signal(1);
  pageSize = 10;
  editingId = signal<string | null>(null);
  editModel = signal<AdminTopicQuestionUpdate | null>(null);
  loadingTopics = signal(true);
  loadingQuestions = signal(false);
  loadingIssues = signal(false);
  saving = signal(false);
  error = signal('');
  success = signal('');

  filteredTopics = computed(() => {
    const q = this.normalize(this.topicSearch());
    return this.topics().filter(topic =>
      !q || this.normalize(`Tema ${topic.number ?? ''} ${topic.name}`).includes(q)
    );
  });

  filteredQuestions = computed(() => {
    const q = this.normalize(this.questionSearch());
    if (!q) return this.questions();

    return this.questions().filter(question => {
      const options = (question.question_options ?? []).map(option => option.text).join(' ');
      return this.normalize(`${question.statement} ${question.source_reference ?? ''} ${question.explanation ?? ''} ${options}`).includes(q);
    });
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredQuestions().length / this.pageSize)));

  pagedQuestions = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.filteredQuestions().slice(start, start + this.pageSize);
  });

  constructor(private data: DataService) {}

  async ngOnInit() {
    await this.loadTopics();
  }

  async loadTopics() {
    this.loadingTopics.set(true);
    this.error.set('');

    try {
      const topics = await this.data.adminListTopicQuestionStats();
      this.topics.set(topics);

      const selected = this.selectedTopic();
      if (selected) {
        this.selectedTopic.set(topics.find(topic => topic.id === selected.id) ?? null);
      }
    } catch (e: any) {
      this.error.set(e?.message ?? 'No se pudieron cargar los temas.');
    } finally {
      this.loadingTopics.set(false);
    }
  }

  async selectTopic(topic: AdminTopicQuestionStats) {
    this.selectedTopic.set(topic);
    this.page.set(1);
    this.questionSearch.set('');
    this.cancelEdit();
    await this.loadQuestions(topic.id);
  }

  async loadQuestions(topicId = this.selectedTopic()?.id) {
    if (!topicId) return;

    this.loadingQuestions.set(true);
    this.error.set('');

    try {
      this.questions.set(await this.data.adminListTopicQuestions(topicId));
    } catch (e: any) {
      this.error.set(e?.message ?? 'No se pudieron cargar las preguntas.');
    } finally {
      this.loadingQuestions.set(false);
    }
  }

  async showIssues() {
    this.activeTab.set('issues');
    if (!this.issues().length) await this.loadIssues();
  }

  async loadIssues() {
    this.loadingIssues.set(true);
    this.error.set('');

    try {
      this.issues.set(await this.data.adminListQuestionIssues(this.issueStatusFilter()));
    } catch (e: any) {
      this.error.set(e?.message ?? 'No se pudieron cargar los avisos.');
    } finally {
      this.loadingIssues.set(false);
    }
  }

  async changeIssueFilter(value: string) {
    const next = value === 'RESOLVED' || value === 'all' ? value : 'OPEN';
    this.issueStatusFilter.set(next);
    await this.loadIssues();
  }

  async openIssueQuestion(issue: QuestionIssue) {
    const topicId = issue.questions?.topic_id;
    if (!topicId) return;

    this.activeTab.set('maintenance');

    let topic = this.topics().find(item => item.id === topicId);
    if (!topic) {
      await this.loadTopics();
      topic = this.topics().find(item => item.id === topicId);
    }

    if (!topic) {
      this.error.set('No se encontro el tema asociado a la pregunta.');
      return;
    }

    await this.selectTopic(topic);
    const question = this.questions().find(item => item.id === issue.question_id);
    if (question) {
      this.questionSearch.set(question.statement.slice(0, 80));
      this.page.set(1);
      this.startEdit(question);
    }
  }

  async setIssueStatus(issue: QuestionIssue, status: QuestionIssueStatus) {
    this.saving.set(true);
    this.error.set('');
    this.success.set('');

    try {
      await this.data.adminSetQuestionIssueStatus(issue.id, status);
      await this.loadIssues();
      this.success.set(status === 'RESOLVED' ? 'Aviso marcado como solucionado.' : 'Aviso reabierto.');
    } catch (e: any) {
      this.error.set(e?.message ?? 'No se pudo actualizar el aviso.');
    } finally {
      this.saving.set(false);
    }
  }

  setQuestionSearch(value: string) {
    this.questionSearch.set(value);
    this.page.set(1);
  }

  startEdit(question: Question) {
    if (this.editingId() === question.id) {
      this.cancelEdit();
      return;
    }

    this.editingId.set(question.id);
    this.editModel.set({
      statement: question.statement,
      explanation: question.explanation,
      source_reference: question.source_reference,
      options: this.sortedOptions(question).map(option => ({
        id: option.id,
        text: option.text,
        position: option.position,
        is_correct: option.is_correct
      }))
    });
  }

  cancelEdit() {
    this.editingId.set(null);
    this.editModel.set(null);
  }

  patchEdit(update: Partial<AdminTopicQuestionUpdate>) {
    const model = this.editModel();
    if (!model) return;
    this.editModel.set({ ...model, ...update });
  }

  patchOption(optionId: string, text: string) {
    const model = this.editModel();
    if (!model) return;
    this.editModel.set({
      ...model,
      options: model.options.map(option => option.id === optionId ? { ...option, text } : option)
    });
  }

  markCorrect(optionId: string) {
    const model = this.editModel();
    if (!model) return;
    this.editModel.set({
      ...model,
      options: model.options.map(option => ({ ...option, is_correct: option.id === optionId }))
    });
  }

  async saveEdit(questionId: string) {
    const model = this.editModel();
    if (!model || !this.validate(model)) return;

    this.saving.set(true);
    this.error.set('');
    this.success.set('');

    try {
      await this.data.adminUpdateTopicQuestion(questionId, model);
      await this.loadQuestions();
      this.cancelEdit();
      this.success.set('Pregunta actualizada.');
    } catch (e: any) {
      this.error.set(e?.message ?? 'No se pudo guardar la pregunta.');
    } finally {
      this.saving.set(false);
    }
  }

  async deleteQuestion(question: Question) {
    if (!confirm('Eliminar esta pregunta? Tambien se eliminaran sus opciones y respuestas asociadas.')) return;

    this.error.set('');
    this.success.set('');

    try {
      await this.data.adminDeleteTopicQuestion(question.id);
      this.questions.update(list => list.filter(item => item.id !== question.id));
      this.topics.update(list => list.map(topic =>
        topic.id === question.topic_id ? { ...topic, question_count: Math.max(0, topic.question_count - 1) } : topic
      ));
      this.cancelEdit();
      this.success.set('Pregunta eliminada.');
    } catch (e: any) {
      this.error.set(e?.message ?? 'No se pudo eliminar la pregunta.');
    }
  }

  async deleteTopicQuestions() {
    const topic = this.selectedTopic();
    if (!topic) return;

    if (!confirm(`Eliminar todas las preguntas del Tema ${topic.number} - ${topic.name}? Esta accion no se puede deshacer.`)) return;

    this.error.set('');
    this.success.set('');

    try {
      await this.data.adminDeleteTopicQuestions(topic.id);
      this.questions.set([]);
      this.topics.update(list => list.map(item => item.id === topic.id ? { ...item, question_count: 0 } : item));
      this.selectedTopic.update(item => item ? { ...item, question_count: 0 } : item);
      this.cancelEdit();
      this.success.set('Bloque de preguntas eliminado.');
    } catch (e: any) {
      this.error.set(e?.message ?? 'No se pudo eliminar el bloque de preguntas.');
    }
  }

  previousPage() {
    this.page.set(Math.max(1, this.page() - 1));
  }

  nextPage() {
    this.page.set(Math.min(this.totalPages(), this.page() + 1));
  }

  sortedOptions(question: Question) {
    return [...(question.question_options ?? [])].sort((a, b) => a.position - b.position);
  }

  optionLetter(index: number) {
    return ['A', 'B', 'C', 'D'][index] ?? '?';
  }

  formatProfileName(profile: QuestionIssue['profiles']) {
    if (!profile) return 'Alumno';
    const fullName = profile.full_name || [profile.first_name, profile.last_name_1, profile.last_name_2].filter(Boolean).join(' ');
    return fullName || profile.email || 'Alumno';
  }

  formatDate(value: string | null) {
    if (!value) return '';
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  }

  private validate(model: AdminTopicQuestionUpdate) {
    if (!model.statement.trim()) {
      this.error.set('No se puede guardar una pregunta sin enunciado.');
      return false;
    }

    if (model.options.some(option => !option.text.trim())) {
      this.error.set('No se pueden guardar opciones vacias.');
      return false;
    }

    if (model.options.filter(option => option.is_correct).length !== 1) {
      this.error.set('Debe haber exactamente una respuesta correcta.');
      return false;
    }

    return true;
  }

  private normalize(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
