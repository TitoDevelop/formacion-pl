import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DataService } from '../../core/data.service';
import { Topic } from '../../core/models';
@Component({standalone:true,imports:[DatePipe,RouterLink],template:`
@if(loading()){<div class="panel empty-state">Cargando progreso del tema…</div>}@else{@if(topic();as t){
<header class="topic-hero"><div><a routerLink="/app/tests" class="back-link">← Volver a tests</a><span class="eyebrow">PREGUNTAS POR TEMA</span><h1>TEMA {{t.number}} · {{t.name}}</h1><p>Entrenamiento, progreso y recursos del tema.</p></div></header>
<div class="topic-detail-layout"><main>
<section class="panel topic-start-panel"><div class="topic-start-row"><div><span class="topic-mini-icon">☷</span><strong>Tema {{t.number}} · Recopilación</strong></div><button class="text-action" (click)="startTest()">Iniciar test ▶</button></div></section>
<section class="panel"><div class="panel-head"><div><h2>Tu progreso</h2><p>{{progress().answeredQuestions}} de {{progress().totalQuestions}} preguntas vistas.</p></div><strong class="progress-percent">{{progress().completion}}%</strong></div><div class="topic-progress-bar"><div [style.width.%]="progress().completion"></div></div><div class="topic-progress-stats"><div><strong>{{progress().accuracy}}%</strong><span>Acierto actual</span></div><div><strong>{{progress().correctAnswers}}</strong><span>Correctas actuales</span></div><div><strong>{{progress().wrongAnswers}}</strong><span>Pendientes de reforzar</span></div></div></section>
<section class="panel"><h2>Descargables</h2>@if(!resources().length){<div class="download-empty">No hay ningún descargable para este tema.</div>}@else{<div class="resource-list">@for(r of resources();track r.id){<div class="resource-row"><div><span class="resource-icon">↓</span><div><strong>{{r.title}}</strong><small>{{r.file_name}}</small></div></div><button class="btn" (click)="download(r)">Descargar</button></div>}</div>}</section>
<section class="panel topic-failed-panel"><div><strong>Preguntas pendientes de repasar</strong><span>{{progress().failedQuestionIds.length}} preguntas falladas actualmente</span></div><button class="btn" [disabled]="!progress().failedQuestionIds.length" (click)="practiceFailed()">↻ Practicar</button></section>
<section class="panel"><h2>Historial</h2>@if(!progress().attempts.length){<div class="download-empty">Todavía no has realizado tests de este tema.</div>}@else{<div class="topic-history">@for(a of progress().attempts;track a.id){<div class="topic-history-row"><div><strong>{{a.title||('Tema '+t.number)}}</strong><small>{{a.mode==='PRACTICE'?'Práctico':'Examen'}}</small></div><span>{{a.score}}/10 · {{a.correct_answers}}/{{a.total_questions}} · {{a.finished_at|date:'dd/MM/yyyy'}}</span></div>}</div>}</section>
</main><aside><section class="topic-side-card"><div class="topic-side-banner"><img src="/alpha-logo.png" alt="Alpha"><span>RECOPILACIÓN</span></div><div class="topic-side-body"><span class="eyebrow">TEMA {{t.number}}</span><h2>{{t.name}}</h2><div class="included-box"><span>¿Qué incluye?</span><strong>✓ {{progress().totalQuestions}} preguntas</strong><strong>✓ {{resources().length}} descargables</strong></div></div></section></aside></div>
}}
`})
export class TopicDetailComponent implements OnInit{
 topic=signal<Topic|null>(null);progress=signal<any>({totalQuestions:0,answeredQuestions:0,correctAnswers:0,wrongAnswers:0,accuracy:0,completion:0,failedQuestionIds:[],attempts:[]});resources=signal<any[]>([]);loading=signal(true);
 constructor(private route:ActivatedRoute,private router:Router,private data:DataService){}
 async ngOnInit(){const id=this.route.snapshot.paramMap.get('id')!;try{const [t,p,r]=await Promise.all([this.data.getTopic(id),this.data.getTopicProgress(id),this.data.listTopicResources(id)]);this.topic.set(t);this.progress.set(p);this.resources.set(r);}finally{this.loading.set(false)}}
 startTest(){this.router.navigate(['/app/crear-test'],{queryParams:{topic:this.topic()!.id}})}
 practiceFailed(){this.router.navigate(['/app/test/falladas-tema'],{queryParams:{topic:this.topic()!.id,count:this.progress().failedQuestionIds.length,mode:'PRACTICE'}})}
 async download(r:any){const url=await this.data.getTopicResourceDownloadUrl(r.storage_path);window.open(url,'_blank','noopener')}
}
