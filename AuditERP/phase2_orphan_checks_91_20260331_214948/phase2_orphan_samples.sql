set pagesize 200
set linesize 32767
set trimspool on

prompt ==== ERDO_LGFA_FK (SRI_DETALOGF -> SRI_LOGFACTU) ORPHANS=4 ====
select * from (select c.rowid as child_rowid, c.LGFA_LGFA_ID from SYSTEM.SRI_DETALOGF c where c.LGFA_LGFA_ID is not null and not exists (select 1 from SYSTEM.SRI_LOGFACTU p where p.LGFA_ID = c.LGFA_LGFA_ID)) where rownum <= 20;
exit