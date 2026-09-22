import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DataService } from '../../core/data.service';
import { QuestionOfficialFilter, TestMode, Topic } from '../../core/models';
import { formatDuration } from '../../core/test-timer';
@Component({standalone:true,imports:[DatePipe,RouterLink],template:`
@if(loading()){<div class="panel empty-state">Cargando progreso del tema…</div>}@else{@if(topic();as t){
<header class="topic-hero"><div><a routerLink="/app/tests" class="back-link">← Volver a tests</a><span class="eyebrow">PREGUNTAS POR TEMA</span><h1>TEMA {{t.number}} · {{t.name}}</h1><p>Entrenamiento, progreso y recursos del tema.</p></div></header>
<div class="topic-detail-layout"><main>
<section class="panel topic-start-panel"><div class="topic-start-row"><div class="topic-test-info"><span class="topic-test-badge">OF</span><div><strong>Tema {{t.number}} · Preguntas oficiales</strong><small>{{questionCounts().official}} disponibles</small></div></div><button class="text-action" [disabled]="!questionCounts().official" (click)="startTest('official')">{{progressByType().official.draftKey ? 'Seguir con el test' : 'Iniciar test'}} ▶</button></div><div class="topic-start-row"><div class="topic-test-info"><span class="topic-test-badge alt">NO</span><div><strong>Tema {{t.number}} · Preguntas no oficiales</strong><small>{{questionCounts().unofficial}} disponibles</small></div></div><button class="text-action" [disabled]="!questionCounts().unofficial" (click)="startTest('unofficial')">{{progressByType().unofficial.draftKey ? 'Seguir con el test' : 'Iniciar test'}} ▶</button></div></section>
@if(showModePicker()){
<div class="mode-picker-backdrop" (click)="closeModePicker()">
  <section class="panel mode-picker" role="dialog" aria-modal="true" aria-labelledby="topic-mode-title" (click)="$event.stopPropagation()">
    <button class="mode-picker-close" type="button" aria-label="Cerrar" (click)="closeModePicker()">×</button>
    <span class="eyebrow">TEMA {{t.number}}</span>
    <h2 id="topic-mode-title">¿Cómo quieres realizar el test?</h2>
    <p>Se incluirán las {{selectedProgress().totalQuestions}} preguntas {{selectedFilterLabel()}} del tema.</p>
    <div class="launch-mode-grid">
      <button class="launch-mode" [class.selected]="mode==='EXAM'" (click)="mode='EXAM'">
        <span class="launch-mode-icon">📝</span><div><strong>Modo examen</strong><p>Verás la corrección al finalizar.</p></div><span class="radio-dot"></span>
      </button>
      <button class="launch-mode" [class.selected]="mode==='PRACTICE'" (click)="mode='PRACTICE'">
        <span class="launch-mode-icon">⚡</span><div><strong>Modo práctico</strong><p>Corrección inmediata tras cada respuesta.</p></div><span class="radio-dot"></span>
      </button>
    </div>
    <button class="btn primary wide" (click)="launchTopicTest()">INICIAR TEST</button>
  </section>
</div>
}
<section class="panel"><div class="panel-head"><div><h2>Tu progreso</h2><p>{{progress().answeredQuestions}} de {{progress().totalQuestions}} preguntas vistas.</p></div><strong class="progress-percent">{{progress().completion}}%</strong></div><div class="topic-progress-bar"><div [style.width.%]="progress().completion"></div></div><div class="topic-progress-stats"><div><strong>{{progress().accuracy}}%</strong><span>Acierto actual</span></div><div><strong>{{progress().correctAnswers}}</strong><span>Correctas actuales</span></div><div><strong>{{progress().wrongAnswers}}</strong><span>Pendientes de reforzar</span></div></div></section>
<section class="panel"><h2>Descargables</h2>@if(!resources().length){<div class="download-empty">No hay ningún descargable para este tema.</div>}@else{<div class="resource-list">@for(r of resources();track r.id){<div class="resource-row"><div><span class="resource-icon">↓</span><div><strong>{{r.title}}</strong><small>{{r.file_name}}</small></div></div><button class="btn" (click)="download(r)">Descargar</button></div>}</div>}</section>
<section class="panel topic-failed-panel"><div><strong>Preguntas pendientes de repasar</strong><span>{{progress().failedQuestionIds.length}} preguntas falladas actualmente</span></div><button class="btn" [disabled]="!progress().failedQuestionIds.length" (click)="practiceFailed()">↻ Practicar</button></section>
<section class="panel"><h2>Historial</h2>@if(!progress().attempts.length){<div class="download-empty">Todavía no has realizado tests de este tema.</div>}@else{<div class="topic-history">@for(a of progress().attempts;track a.id){<div class="topic-history-row"><div><strong>{{a.title||('Tema '+t.number)}}</strong><small>{{a.mode==='PRACTICE'?'Práctico':'Examen'}}@if(a.duration_seconds!=null){ · ⏱ {{formatTime(a.duration_seconds)}}}</small></div><span>{{a.score}}/10 · {{a.correct_answers}}/{{a.total_questions}} · {{a.finished_at|date:'dd/MM/yyyy'}}</span></div>}</div>}</section>
</main><aside><section class="topic-side-card"><div class="topic-side-banner"><img src="/alpha-logo.png" alt="Alpha"><span>RECOPILACIÓN</span></div><div class="topic-side-body"><span class="eyebrow">TEMA {{t.number}}</span><h2>{{t.name}}</h2><div class="included-box"><span>¿Qué incluye?</span><strong>✓ {{questionCounts().official}} oficiales</strong><strong>✓ {{questionCounts().unofficial}} no oficiales</strong><strong>✓ {{resources().length}} descargables</strong></div></div></section></aside></div>
}}
`})
export class TopicDetailComponent implements OnInit{
 topic=signal<Topic|null>(null);progress=signal<any>({totalQuestions:0,answeredQuestions:0,correctAnswers:0,wrongAnswers:0,accuracy:0,completion:0,failedQuestionIds:[],attempts:[]});progressByType=signal<any>({official:{totalQuestions:0},unofficial:{totalQuestions:0}});questionCounts=signal({official:0,unofficial:0,total:0});resources=signal<any[]>([]);loading=signal(true);showModePicker=signal(false);mode:TestMode='EXAM';selectedFilter:QuestionOfficialFilter='official';
 constructor(private route:ActivatedRoute,private router:Router,private data:DataService){}
 async ngOnInit(){const id=this.route.snapshot.paramMap.get('id')!;try{const [t,p,po,pn,c,r]=await Promise.all([this.data.getTopic(id),this.data.getTopicProgress(id),this.data.getTopicProgress(id,'official'),this.data.getTopicProgress(id,'unofficial'),this.data.countTopicQuestionKinds(id),this.data.listTopicResources(id)]);this.topic.set(t);this.progress.set(p);this.progressByType.set({official:po,unofficial:pn});this.questionCounts.set(c);this.resources.set(r);}finally{this.loading.set(false)}}
 startTest(filter:QuestionOfficialFilter){this.selectedFilter=filter;const draftKey=this.selectedProgress().draftKey;if(draftKey){this.router.navigateByUrl(draftKey);return}this.showModePicker.set(true)}
 continueTest(){this.router.navigateByUrl(this.progress().draftKey)}
 closeModePicker(){this.showModePicker.set(false)}
 launchTopicTest(){this.router.navigate(['/app/test/personalizado'],{queryParams:{topics:this.topic()!.id,mode:this.mode,all:true,questionType:this.selectedFilter}})}
 practiceFailed(){this.router.navigate(['/app/test/falladas-tema'],{queryParams:{topic:this.topic()!.id,count:this.progress().failedQuestionIds.length,mode:'PRACTICE'}})}
 async download(r:any){const url=await this.data.getTopicResourceDownloadUrl(r.storage_path);window.open(url,'_blank','noopener')}
 formatTime(seconds:number){return formatDuration(seconds)}
 selectedProgress(){return this.selectedFilter==='unofficial'?this.progressByType().unofficial:this.progressByType().official}
 selectedFilterLabel(){return this.selectedFilter==='unofficial'?'no oficiales':'oficiales'}
}
