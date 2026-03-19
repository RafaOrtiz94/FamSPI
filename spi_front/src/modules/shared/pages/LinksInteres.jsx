import React from "react";
import { NavLink } from "react-router-dom";
import {
 FiExternalLink,
 FiBookOpen,
 FiTool,
 FiUsers,
 FiClipboard,
 FiFileText,
 FiShield,
 FiBriefcase,
} from "react-icons/fi";
import Card from "../../../core/ui/components/Card";

const LinksInteres = () => {
 const sections = [
 {
 id: "servicio",
 title: "Servicio",
 icon: FiTool,
 items: [
 {
 label: "Calendario de mantenimientos",
 href: "https://docs.google.com/document/d/1PLiddFX3Zk9uoApxDrlTugTihZlCGkm2BopjGabNdCQ/edit?usp=sharing",
 },
 {
 label: "Conectividad Equipos",
 href: "https://sites.google.com/famproject.com.ec/progreso/p%C3%A1gina-principal",
 },
 {
 label: "Formatos Servicio",
 href: "https://drive.google.com/drive/folders/1gJtk_HuDbBPgqZdjLM5rH8ed2WskdVui?usp=drive_link",
 },
 {
 label: "Procedimientos Servicio",
 href: "https://drive.google.com/drive/folders/1f6E-QjHVRnXuiK9fkYiH7icqjBW18TE5?usp=drive_link",
 },
 {
 label: "eLabDoc",
 href: "https://elabdoc-prod.roche.com/eLD/web/ec/es/home",
 },
 {
 label: "Cornerstone",
 href: "https://roche.csod.com/",
 },
 ],
 },
 {
 id: "comercial",
 title: "Comercial",
 icon: FiBriefcase,
 items: [
 {
 label: "Procedimientos Comercial",
 href: "https://drive.google.com/drive/folders/1JBO5aWGGDI5BdfjpjrZPY5AjlBcKvF_y?usp=drive_link",
 },
 {
 label: "Formatos Comercial",
 href: "https://drive.google.com/drive/folders/16NJThZzMgu-cOZ9Z_e538vJ-CvAZ0g6M?usp=drive_link",
 },
 {
 label: "Registro Nuevo Cliente",
 href: "/dashboard/comercial/new-client-request",
 internal: true,
 },
 {
 label: "Solicitud Requerimiento de Proceso de Compra",
 href: "/dashboard/comercial/solicitudes",
 internal: true,
 },
 {
 label: "Catálogo Roche 2023",
 href: "https://rochedia.showpad.com/share/3u2ab8u9LJjoRmrANDVdM/0",
 },
 {
 label: "Capacitación Comercial",
 href: "https://sites.google.com/famproject.com.ec/bienvenido-al-equipo-comercial/roche",
 },
 ],
 },
 {
 id: "rrhh",
 title: "Recursos Humanos",
 icon: FiUsers,
 items: [
 {
 label: "Formatos RRHH",
 href: "https://drive.google.com/drive/folders/1oil3wCsFUabW7qvZ8tDbd_YHGYVZ4G3y?usp=drive_link",
 },
 {
 label: "Procedimientos RRHH",
 href: "https://drive.google.com/drive/folders/1ZJ2IbG0XGt5ScW_ozfMl8Sv6XE_t_Qk-?usp=drive_link",
 },
 {
 label: "KPIs Calificación ROCHE",
 href: "https://drive.google.com/file/d/1fNlanGorn6q-iu-sqe41XeJm4VAX0SDn/view?usp=drive_link",
 },
 ],
 },
 {
 id: "contabilidad",
 title: "Contabilidad",
 icon: FiClipboard,
 items: [
 {
 label: "Formato Viáticos",
 href: "https://docs.google.com/spreadsheets/d/10SaqYTVsAM9qfo6nNXNinUPaPPMns1vm/edit?usp=sharing&ouid=104656986317619958423&rtpof=true&sd=true",
 },
 {
 label: "Datos Facturación",
 href: "https://drive.google.com/file/d/1BkT7IssQZqjmwXDjGgBEgKRmqPly0G2v/view?usp=sharing",
 },
 {
 label: "Documentos Habilitantes",
 href: "https://drive.google.com/drive/folders/1m0fn88a3QTgt-Pyn3ll4SlQTfaYC08-M?usp=drive_link",
 },
 ],
 },
 {
 id: "calidad",
 title: "Calidad",
 icon: FiShield,
 items: [
 {
 label: "Capacitaciones",
 href: "https://drive.google.com/drive/folders/13-2gidh2V5vYxp_nWI5FyXaSNal5cS6a",
 },
 {
 label: "Evaluaciones",
 href: "https://drive.google.com/drive/folders/1zT3MVrwDx5TIPzepY1lFANlJGL6SR7Wc?usp=sharing",
 },
 {
 label: "Documentación Interna",
 href: "https://drive.google.com/drive/folders/1JZpQv8TvqHePr2tE9QiSEX5irA5S1Mfg?usp=drive_link",
 },
 ],
 },
 {
 id: "general",
 title: "General",
 icon: FiBookOpen,
 items: [
 {
 label: "Reglamento Interno",
 href: "https://drive.google.com/drive/folders/1IgEfwlQE7qnrI4kfdHUKbWuRRA5oej9t?usp=sharing",
 },
 ],
 },
 ];

 return (
 <div className="space-y-4 sm:space-y-6">
 <div className="flex items-center gap-3">
 <div className="p-2 rounded-2xl bg-slate-100">
 <FiBookOpen className="text-slate-700" />
 </div>
 <div>
 <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Links de Interés</h1>
 <p className="text-xs sm:text-sm text-slate-600">
 Accesos directos a documentos y recursos del equipo.
 </p>
 </div>
 </div>

 <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
 {sections.map((section) => {
 const Icon = section.icon;
 return (
 <Card
 key={section.id}
 className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm"
 >
 <div className="flex items-center gap-2 mb-3">
 <div className="p-1.5 rounded-xl bg-slate-100">
 <Icon className="text-slate-700" size={16} />
 </div>
 <h2 className="text-sm font-semibold text-slate-900">{section.title}</h2>
 </div>

 <div className="space-y-2">
 {section.items.map((item) => {
 if (item.internal) {
 return (
 <NavLink
 key={item.label}
 to={item.href}
 className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50"
 >
 <span className="truncate">{item.label}</span>
 <FiExternalLink className="text-slate-400" size={14} />
 </NavLink>
 );
 }
 return (
 <a
 key={item.label}
 href={item.href}
 target="_blank"
 rel="noreferrer"
 className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50"
 >
 <span className="truncate">{item.label}</span>
 <FiExternalLink className="text-slate-400" size={14} />
 </a>
 );
 })}
 </div>
 </Card>
 );
 })}
 </div>
 </div>
 );
};

export default LinksInteres;
