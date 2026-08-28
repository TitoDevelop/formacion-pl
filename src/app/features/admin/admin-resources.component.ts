import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/data.service';
import { Topic } from '../../core/models';
@Component({standalone:true,imports:[FormsModule],template:`
<header class="page-title"><div><span class="eyebrow">ADMINISTRACIÓN</span><h1>Recursos por tema</h1><p>Sube PDFs, esquemas y documentos para los alumnos.</p></div></header>
<div class="resources-admin-layout"><section class="panel"><h2>Subir documento</h2><label>Tema</label><select [(ngModel)]="topicId" (ngModelChange)="loadResources()"><option value="">Selecciona un tema</option>@for(t of topics();track t.id){<option [value]="t.id">Tema {{t.number}} · {{t.name}}</option>}</select><label>Título visible</label><input [(ngModel)]="title" placeholder="Ej. Esquema Constitución Española"><label class="dropzone resource-upload-zone"><strong>{{file?.name||'Seleccionar documento'}}</strong><span>PDF, DOCX, XLSX, imágenes u otros archivos.</span><input type="file" hidden (change)="selectFile($event)"></label>@if(error()){<div class="form-error">{{error()}}</div>}@if(success()){<div class="form-info">{{success()}}</div>}<button class="btn primary wide" [disabled]="!topicId||!file||uploading()" (click)="upload()">{{uploading()?'SUBIENDO…':'SUBIR DOCUMENTO'}}</button></section>
<section class="panel"><h2>Documentos del tema</h2>@if(!topicId){<div class="empty-state">Selecciona un tema.</div>}@else if(!resources().length){<div class="empty-state">Este tema todavía no tiene documentos.</div>}@else{<div class="resource-admin-list">@for(r of resources();track r.id){<div class="resource-admin-row"><div><strong>{{r.title}}</strong><small>{{r.file_name}}</small></div><button class="btn danger-btn" (click)="remove(r)">Eliminar</button></div>}</div>}</section></div>
`})
export class AdminResourcesComponent implements OnInit{
 topics=signal<Topic[]>([]);resources=signal<any[]>([]);error=signal('');success=signal('');uploading=signal(false);topicId='';title='';file:File|null=null;
 constructor(private data:DataService){}
 async ngOnInit(){this.topics.set(await this.data.listTopics())}
 selectFile(e:Event){const i=e.target as HTMLInputElement;this.file=i.files?.[0]??null;if(this.file&&!this.title)this.title=this.file.name.replace(/\.[^.]+$/,'')}
 async loadResources(){this.error.set('');this.success.set('');if(!this.topicId){this.resources.set([]);return;}this.resources.set(await this.data.listTopicResources(this.topicId))}
 async upload(){if(!this.topicId||!this.file)return;this.uploading.set(true);this.error.set('');this.success.set('');try{await this.data.adminUploadTopicResource(this.topicId,this.title,this.file);this.success.set('✓ Documento subido correctamente.');this.title='';this.file=null;await this.loadResources();}catch(e:any){this.error.set(e?.message??'No se pudo subir el documento.')}finally{this.uploading.set(false)}}
 async remove(r:any){if(!confirm(`¿Eliminar "${r.title}"?`))return;try{await this.data.adminDeleteTopicResource(r);await this.loadResources()}catch(e:any){this.error.set(e?.message??'No se pudo eliminar el documento.')}}
}
