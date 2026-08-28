import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DataService } from '../../core/data.service';
import { ExamQuestionRow, OfficialExam, QuestionOption, TestMode } from '../../core/models';

@Component({ standalone: true, template: `
@if (loading()) { <div class="panel empty-state">Preparando examen…</div> }
@else if (exam()) {
  <div class="exam-topline"><div><span class="eyebrow">{{ mode()==='PRACTICE' ? 'OFICIAL · MODO PRÁCTICO' : 'EXAMEN OFICIAL' }}</span><h1>{{ exam()!.municipality }} · {{ exam()!.year }}</h1></div><div class="progress-text">{{ currentIndex()+1 }} / {{ questions().length }}</div></div>
  <div class="progress"><div [style.width.%]="progress()"></div></div>
  @if (current(); as row) {
    <article class="question-card">
      <div class="question-toolbar"><span class="question-meta">Pregunta {{ row.question_number || currentIndex()+1 }}</span><button class="review-btn" [class.marked]="marked().has(row.question_id)" (click)="toggleMarked(row.question_id)">{{ marked().has(row.question_id) ? '★ Marcada para repasar' : '☆ Marcar para repasar' }}</button></div>
      <h2>{{ row.questions.statement }}</h2>
      <div class="options">
        @for (opt of sortedOptions(row); track opt.id) {
          <button class="option" [class.selected]="selected()[row.question_id] === opt.id" [class.correct]="mode()==='PRACTICE' && answered().has(row.question_id) && opt.is_correct" [class.incorrect]="mode()==='PRACTICE' && answered().has(row.question_id) && selected()[row.question_id] === opt.id && !opt.is_correct" [disabled]="mode()==='PRACTICE' && answered().has(row.question_id)" (click)="select(row,opt)"><span>{{ letter(opt.position) }}</span><p>{{ opt.text }}</p></button>
        }
      </div>
      @if (mode()==='PRACTICE' && answered().has(row.question_id)) {
        <div class="practice-feedback" [class.ok]="isCorrect(row)"><strong>{{ isCorrect(row) ? '✓ Correcta' : '✗ Incorrecta' }}</strong>@if (!isCorrect(row)) { <span>Respuesta correcta: {{ correctText(row) }}</span> } @if (row.questions.explanation) { <p>{{ row.questions.explanation }}</p> }</div>
      }
    </article>
    <div class="exam-nav"><button class="btn" (click)="prev()" [disabled]="currentIndex()===0">← Anterior</button>@if (currentIndex() < questions().length-1) { <button class="btn primary" (click)="next()" [disabled]="mode()==='PRACTICE' && !answered().has(row.question_id)">Siguiente →</button> } @else { <button class="btn success" (click)="finish()" [disabled]="submitting() || (mode()==='PRACTICE' && !answered().has(row.question_id))">{{ submitting() ? 'Guardando…' : 'Finalizar' }}</button> }</div>
  }
}
`})
export class ExamPlayerComponent implements OnInit {
  exam=signal<OfficialExam|null>(null); questions=signal<ExamQuestionRow[]>([]); currentIndex=signal(0); selected=signal<Record<string,string>>({}); answered=signal<Set<string>>(new Set()); marked=signal<Set<string>>(new Set()); mode=signal<TestMode>('EXAM'); loading=signal(true); submitting=signal(false);
  progress=computed(()=>this.questions().length?((this.currentIndex()+1)/this.questions().length)*100:0); current=computed(()=>this.questions()[this.currentIndex()]??null);
  constructor(private route:ActivatedRoute,private router:Router,private data:DataService){}
  async ngOnInit(){ const id=this.route.snapshot.paramMap.get('id')!; this.mode.set(this.route.snapshot.queryParamMap.get('mode')==='PRACTICE'?'PRACTICE':'EXAM'); try{ const [exam,questions]=await Promise.all([this.data.getExam(id),this.data.getExamQuestions(id)]); this.exam.set(exam); this.questions.set(questions); this.marked.set(await this.data.reviewQuestionIds(questions.map(q=>q.question_id))); }finally{this.loading.set(false);} }
  sortedOptions(row:ExamQuestionRow){return [...(row.questions.question_options??[])].sort((a,b)=>a.position-b.position)} letter(pos:number){return ['A','B','C','D'][pos-1]??'?'}
  select(row:ExamQuestionRow,opt:QuestionOption){ if(this.mode()==='PRACTICE'&&this.answered().has(row.question_id))return; this.selected.update(s=>({...s,[row.question_id]:opt.id})); if(this.mode()==='PRACTICE')this.answered.update(set=>{const n=new Set(set);n.add(row.question_id);return n;}); }
  isCorrect(row:ExamQuestionRow){const id=this.selected()[row.question_id];return row.questions.question_options?.some(o=>o.id===id&&o.is_correct)??false} correctText(row:ExamQuestionRow){return row.questions.question_options?.find(o=>o.is_correct)?.text??'No disponible'}
  async toggleMarked(id:string){const v=!this.marked().has(id);await this.data.setReview(id,v);this.marked.update(s=>{const n=new Set(s);v?n.add(id):n.delete(id);return n;});}
  next(){if(this.currentIndex()<this.questions().length-1)this.currentIndex.update(i=>i+1)} prev(){if(this.currentIndex()>0)this.currentIndex.update(i=>i-1)}
  async finish(){ if(this.mode()==='EXAM'&&!confirm('¿Finalizar el examen y ver la corrección?'))return; this.submitting.set(true); try{ const payload=this.questions().map(row=>{const id=this.selected()[row.question_id]??null;const c=row.questions.question_options?.find(o=>o.is_correct);return{questionId:row.question_id,selectedOptionId:id,correct:!!id&&id===c?.id}}); const e=this.exam()!; const attemptId=await this.data.finishAttempt(e.id,'OFFICIAL',this.mode(),e.name,null,payload); await this.router.navigate(['/app/resultado',attemptId]); }finally{this.submitting.set(false);} }
}
