set pagesize 0 feedback off verify off heading on echo off termout off
set trimspool on linesize 32767
set markup csv on quote on
select * from (
select 'SYSTEM' as child_owner, 'ADM_DETAUTOR' as child_table, 'DTAU_AUTO_FK' as fk_name, 'SYSTEM' as parent_owner, 'ADM_AUTORIZA' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.ADM_DETAUTOR c where c.AUTO_AUTO_ID is not null and not exists (select 1 from SYSTEM.ADM_AUTORIZA p where p.AUTO_ID = c.AUTO_AUTO_ID)
union all
select 'SYSTEM' as child_owner, 'AFJ_AFDETMOV' as child_table, 'AFDM_AFRQ_FK' as fk_name, 'SYSTEM' as parent_owner, 'AFJ_AFREQUIS' as parent_table, 2 as fk_columns, count(*) as orphan_count from SYSTEM.AFJ_AFDETMOV c where c.AFRQ_NUMERO is not null and c.AFRQ_ENTRSALE is not null and not exists (select 1 from SYSTEM.AFJ_AFREQUIS p where p.NUMERO = c.AFRQ_NUMERO and p.ENTRSALE = c.AFRQ_ENTRSALE)
union all
select 'SYSTEM' as child_owner, 'AFJ_AFDETMOV' as child_table, 'AFDM_INRN_FK' as fk_name, 'SYSTEM' as parent_owner, 'INF_RESPNODO' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.AFJ_AFDETMOV c where c.INRN_ID is not null and not exists (select 1 from SYSTEM.INF_RESPNODO p where p.INRN_ID = c.INRN_ID)
union all
select 'SYSTEM' as child_owner, 'AFJ_AFDETMOV' as child_table, 'AFDM_MEMO_FK' as fk_name, 'SYSTEM' as parent_owner, 'AFJ_MEMORAND' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.AFJ_AFDETMOV c where c.MEMO_ID is not null and not exists (select 1 from SYSTEM.AFJ_MEMORAND p where p.MEMO_ID = c.MEMO_ID)
union all
select 'SYSTEM' as child_owner, 'AFJ_AFDETMOV' as child_table, 'AFDM_RCDP_FK' as fk_name, 'SYSTEM' as parent_owner, 'CLI_RCCLDAPE' as parent_table, 3 as fk_columns, count(*) as orphan_count from SYSTEM.AFJ_AFDETMOV c where c.RCDP_COMPANIA is not null and c.RCDP_IDCLIENTE is not null and c.RCDP_IDRESCLI is not null and not exists (select 1 from SYSTEM.CLI_RCCLDAPE p where p.CLTE_COMPANIA = c.RCDP_COMPANIA and p.CLTE_IDCLIENTE = c.RCDP_IDCLIENTE and p.IDRESCLI = c.RCDP_IDRESCLI)
union all
select 'SYSTEM' as child_owner, 'AFJ_AFDETMOV' as child_table, 'AFDM_STCT_FK' as fk_name, 'SYSTEM' as parent_owner, 'SRV_STCOTRRE' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.AFJ_AFDETMOV c where c.STCT_ID is not null and not exists (select 1 from SYSTEM.SRV_STCOTRRE p where p.ID = c.STCT_ID)
union all
select 'SYSTEM' as child_owner, 'AFJ_AFDETMOV' as child_table, 'AFDM_UMED_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_UNIDMEDI' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.AFJ_AFDETMOV c where c.UMED_UNIDMEDI is not null and not exists (select 1 from SYSTEM.ALM_UNIDMEDI p where p.UNIDMEDI = c.UMED_UNIDMEDI)
union all
select 'SYSTEM' as child_owner, 'AFJ_DETALLE' as child_table, 'DAC1_ASTO_FK' as fk_name, 'SYSTEM' as parent_owner, 'CNT_ASIENTO' as parent_table, 2 as fk_columns, count(*) as orphan_count from SYSTEM.AFJ_DETALLE c where c.ASTO_COMPANIA is not null and c.ASTO_NUMEDIAR is not null and not exists (select 1 from SYSTEM.CNT_ASIENTO p where p.CMPN_COMPANIA = c.ASTO_COMPANIA and p.NUMEDIAR = c.ASTO_NUMEDIAR)
union all
select 'SYSTEM' as child_owner, 'AFJ_DETALLE' as child_table, 'DAC1_MEMO_FK' as fk_name, 'SYSTEM' as parent_owner, 'AFJ_MEMORAND' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.AFJ_DETALLE c where c.MEMO_MEMO_ID is not null and not exists (select 1 from SYSTEM.AFJ_MEMORAND p where p.MEMO_ID = c.MEMO_MEMO_ID)
union all
select 'SYSTEM' as child_owner, 'ALM_DETABASC' as child_table, 'DTBA_PRFM_FK' as fk_name, 'SYSTEM' as parent_owner, 'VEN_PROFORMA' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_DETABASC c where c.PRFM_PRFM_ID is not null and not exists (select 1 from SYSTEM.VEN_PROFORMA p where p.PRFM_ID = c.PRFM_PRFM_ID)
union all
select 'SYSTEM' as child_owner, 'ALM_DETABASC' as child_table, 'DTBA_UMED_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_UNIDMEDI' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_DETABASC c where c.UMED_UNIDMEDI is not null and not exists (select 1 from SYSTEM.ALM_UNIDMEDI p where p.UNIDMEDI = c.UMED_UNIDMEDI)
union all
select 'SYSTEM' as child_owner, 'ALM_DETADESP' as child_table, 'DTPS_DSPO_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_DESPACHOS' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_DETADESP c where c.DSPO_NUMERO is not null and not exists (select 1 from SYSTEM.ALM_DESPACHOS p where p.NUMERO = c.DSPO_NUMERO)
union all
select 'SYSTEM' as child_owner, 'ALM_DETADESP' as child_table, 'DTPS_EGEN_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_ESTADOS' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_DETADESP c where c.EGEN_ESTADO is not null and not exists (select 1 from SYSTEM.GEN_ESTADOS p where p.ESTADO = c.EGEN_ESTADO)
union all
select 'SYSTEM' as child_owner, 'ALM_DETALOTE' as child_table, 'DTLT_DTMV_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_DETAMOVI' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_DETALOTE c where c.DTMV_DTMV_ID is not null and not exists (select 1 from SYSTEM.ALM_DETAMOVI p where p.DTMV_ID = c.DTMV_DTMV_ID)
union all
select 'SYSTEM' as child_owner, 'ALM_DETALOTE' as child_table, 'DTLT_LOTE_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_LOTE' as parent_table, 3 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_DETALOTE c where c.LOTE_COMPANIA is not null and c.LOTE_NUMELOTE is not null and c.LOTE_ALCANCE is not null and not exists (select 1 from SYSTEM.ALM_LOTE p where p.CMPN_COMPANIA = c.LOTE_COMPANIA and p.NUMELOTE = c.LOTE_NUMELOTE and p.ALCANCE = c.LOTE_ALCANCE)
union all
select 'SYSTEM' as child_owner, 'ALM_DETAMOVI' as child_table, 'DTMV_DCAM_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_DECAMPRES' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_DETAMOVI c where c.DCAM_DCAM_ID is not null and not exists (select 1 from SYSTEM.ALM_DECAMPRES p where p.DCAM_ID = c.DCAM_DCAM_ID)
union all
select 'SYSTEM' as child_owner, 'ALM_DETAMOVI' as child_table, 'DTMV_DREQ_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_DETAREQU' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_DETAMOVI c where c.DREQ_DREQ_ID is not null and not exists (select 1 from SYSTEM.ALM_DETAREQU p where p.DREQ_ID = c.DREQ_DREQ_ID)
union all
select 'SYSTEM' as child_owner, 'ALM_DETAMOVI' as child_table, 'DTMV_DTMV_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_DETAMOVI' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_DETAMOVI c where c.DTMV_DTMV_ID is not null and not exists (select 1 from SYSTEM.ALM_DETAMOVI p where p.DTMV_ID = c.DTMV_DTMV_ID)
union all
select 'SYSTEM' as child_owner, 'ALM_DETAMOVI' as child_table, 'DTMV_ENSA_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_ENTRASALI' as parent_table, 4 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_DETAMOVI c where c.ENSA_COMPANIA is not null and c.ENSA_OFICINA is not null and c.ENSA_TIPODOCU is not null and c.ENSA_NUMERO is not null and not exists (select 1 from SYSTEM.ALM_ENTRASALI p where p.OFCN_COMPANIA = c.ENSA_COMPANIA and p.OFCN_OFICINA = c.ENSA_OFICINA and p.TPDC_TIPODOCU = c.ENSA_TIPODOCU and p.NUMERO = c.ENSA_NUMERO)
union all
select 'SYSTEM' as child_owner, 'ALM_DETAMOVI' as child_table, 'DTMV_IMPT_FK' as fk_name, 'SYSTEM' as parent_owner, 'IMP_IMPORTAC' as parent_table, 3 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_DETAMOVI c where c.IMPT_COMPANIA is not null and c.IMPT_OFICINA is not null and c.IMPT_NUMEIMPO is not null and not exists (select 1 from SYSTEM.IMP_IMPORTAC p where p.OFCN_COMPANIA = c.IMPT_COMPANIA and p.OFCN_OFICINA = c.IMPT_OFICINA and p.NUMEIMPO = c.IMPT_NUMEIMPO)
union all
select 'SYSTEM' as child_owner, 'ALM_DETAMOVI' as child_table, 'DTMV_NCCL_FK' as fk_name, 'SYSTEM' as parent_owner, 'VEN_NOTACRED' as parent_table, 4 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_DETAMOVI c where c.NCCL_COMPANIA is not null and c.NCCL_OFICINA is not null and c.NCCL_SERIE is not null and c.NCCL_NUMERO is not null and not exists (select 1 from SYSTEM.VEN_NOTACRED p where p.OFCN_COMPANIA = c.NCCL_COMPANIA and p.OFCN_OFICINA = c.NCCL_OFICINA and p.SERIE = c.NCCL_SERIE and p.NUMERO = c.NCCL_NUMERO)
union all
select 'SYSTEM' as child_owner, 'ALM_DETAMOVI' as child_table, 'DTMV_NCPR_FK' as fk_name, 'SYSTEM' as parent_owner, 'COM_NOTACREDI' as parent_table, 5 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_DETAMOVI c where c.NCPR_COMPANIA is not null and c.NCPR_CEDURUC is not null and c.NCPR_SERIE is not null and c.NCPR_NUMERO is not null and c.NCPR_ALCANCE is not null and not exists (select 1 from SYSTEM.COM_NOTACREDI p where p.PROV_COMPANIA = c.NCPR_COMPANIA and p.PROV_CEDURUC = c.NCPR_CEDURUC and p.SERIE = c.NCPR_SERIE and p.NUMERO = c.NCPR_NUMERO and p.ALCANCE = c.NCPR_ALCANCE)
union all
select 'SYSTEM' as child_owner, 'ALM_DETAMOVI' as child_table, 'DTMV_RCTA_FK' as fk_name, 'SYSTEM' as parent_owner, 'CST_RECETA' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_DETAMOVI c where c.RCTA_RCTA_ID is not null and not exists (select 1 from SYSTEM.CST_RECETA p where p.RCTA_ID = c.RCTA_RCTA_ID)
union all
select 'SYSTEM' as child_owner, 'ALM_DETAMOVI' as child_table, 'DTMV_SECC_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_SECCFISC' as parent_table, 4 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_DETAMOVI c where c.SECC_COMPANIA is not null and c.SECC_OFICINA is not null and c.SECC_CODIBODE is not null and c.SECC_CODISECC is not null and not exists (select 1 from SYSTEM.ALM_SECCFISC p where p.BDGA_COMPANIA = c.SECC_COMPANIA and p.BDGA_OFICINA = c.SECC_OFICINA and p.BDGA_CODIBODE = c.SECC_CODIBODE and p.CODISECC = c.SECC_CODISECC)
union all
select 'SYSTEM' as child_owner, 'ALM_DETAMOVI' as child_table, 'DTMV_UMED_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_UNIDMEDI' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_DETAMOVI c where c.UMED_UNIDMEDI is not null and not exists (select 1 from SYSTEM.ALM_UNIDMEDI p where p.UNIDMEDI = c.UMED_UNIDMEDI)
union all
select 'SYSTEM' as child_owner, 'ALM_DETAMOVI' as child_table, 'DTMV_UMED_FK2' as fk_name, 'SYSTEM' as parent_owner, 'ALM_UNIDMEDI' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_DETAMOVI c where c.UMED_UNIDMEDI_CAJA is not null and not exists (select 1 from SYSTEM.ALM_UNIDMEDI p where p.UNIDMEDI = c.UMED_UNIDMEDI_CAJA)
union all
select 'SYSTEM' as child_owner, 'ALM_DETAMOVI' as child_table, 'DTMV_VNTA_FK' as fk_name, 'SYSTEM' as parent_owner, 'VEN_VENTAS' as parent_table, 5 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_DETAMOVI c where c.VNTA_COMPANIA is not null and c.VNTA_OFICINA is not null and c.VNTA_SERIE is not null and c.VNTA_NUMERO is not null and c.VNTA_TIPOCOMP is not null and not exists (select 1 from SYSTEM.VEN_VENTAS p where p.OFCN_COMPANIA = c.VNTA_COMPANIA and p.OFCN_OFICINA = c.VNTA_OFICINA and p.SERIE = c.VNTA_SERIE and p.NUMERO = c.VNTA_NUMERO and p.TPCM_TIPOCOMP = c.VNTA_TIPOCOMP)
union all
select 'SYSTEM' as child_owner, 'ALM_DETAPLAN' as child_table, 'DTPL_PLIM_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_PLANIMPR' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_DETAPLAN c where c.PLIM_CODIGO is not null and not exists (select 1 from SYSTEM.ALM_PLANIMPR p where p.CODIGO = c.PLIM_CODIGO)
union all
select 'SYSTEM' as child_owner, 'ALM_DETAPROY' as child_table, 'DPRO_PRPD_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_PROYPROD' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_DETAPROY c where c.PRPD_PRPD_ID is not null and not exists (select 1 from SYSTEM.ALM_PROYPROD p where p.PRPD_ID = c.PRPD_PRPD_ID)
union all
select 'SYSTEM' as child_owner, 'ALM_DETAREQU' as child_table, 'DREQ_REQU_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_REQUERIM' as parent_table, 4 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_DETAREQU c where c.REQU_NUMERO is not null and c.REQU_COMPANIA is not null and c.REQU_OFICINA is not null and c.REQU_TIPODOCU is not null and not exists (select 1 from SYSTEM.ALM_REQUERIM p where p.NUMERO = c.REQU_NUMERO and p.OFCN_COMPANIA = c.REQU_COMPANIA and p.OFCN_OFICINA = c.REQU_OFICINA and p.TPDC_TIPODOCU = c.REQU_TIPODOCU)
union all
select 'SYSTEM' as child_owner, 'ALM_DETAREQU' as child_table, 'DREQ_SECC_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_SECCFISC' as parent_table, 4 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_DETAREQU c where c.SECC_COMPANIA is not null and c.SECC_OFICINA is not null and c.SECC_CODIBODE is not null and c.SECC_CODISECC is not null and not exists (select 1 from SYSTEM.ALM_SECCFISC p where p.BDGA_COMPANIA = c.SECC_COMPANIA and p.BDGA_OFICINA = c.SECC_OFICINA and p.BDGA_CODIBODE = c.SECC_CODIBODE and p.CODISECC = c.SECC_CODISECC)
union all
select 'SYSTEM' as child_owner, 'ALM_DETARTLL' as child_table, 'DATLL_TLLA_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_TALLAS' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_DETARTLL c where c.TLLA_ID_TLLA is not null and not exists (select 1 from SYSTEM.ALM_TALLAS p where p.ID_TLLA = c.TLLA_ID_TLLA)
union all
select 'SYSTEM' as child_owner, 'ALM_DETATOFI' as child_table, 'ADTF_ATFS_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_TOMAFISC' as parent_table, 4 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_DETATOFI c where c.ATFS_COMPANIA is not null and c.ATFS_OFICINA is not null and c.ATFS_NUMERO is not null and c.ATFS_TIPODOCU is not null and not exists (select 1 from SYSTEM.ALM_TOMAFISC p where p.OFCN_COMPANIA = c.ATFS_COMPANIA and p.OFCN_OFICINA = c.ATFS_OFICINA and p.NUMERO = c.ATFS_NUMERO and p.TPDC_TIPODOCU = c.ATFS_TIPODOCU)
union all
select 'SYSTEM' as child_owner, 'ALM_DETATOFI' as child_table, 'ADTF_ENSA_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_ENTRASALI' as parent_table, 4 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_DETATOFI c where c.ENSA_COMPANIA is not null and c.ENSA_OFICINA is not null and c.ENSA_TIPODOCU is not null and c.ENSA_NUMERO is not null and not exists (select 1 from SYSTEM.ALM_ENTRASALI p where p.OFCN_COMPANIA = c.ENSA_COMPANIA and p.OFCN_OFICINA = c.ENSA_OFICINA and p.TPDC_TIPODOCU = c.ENSA_TIPODOCU and p.NUMERO = c.ENSA_NUMERO)
union all
select 'SYSTEM' as child_owner, 'ALM_DETATOFI' as child_table, 'ADTF_SECC_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_SECCFISC' as parent_table, 4 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_DETATOFI c where c.SECC_COMPANIA is not null and c.SECC_OFICINA is not null and c.SECC_CODIBODE is not null and c.SECC_CODISECC is not null and not exists (select 1 from SYSTEM.ALM_SECCFISC p where p.BDGA_COMPANIA = c.SECC_COMPANIA and p.BDGA_OFICINA = c.SECC_OFICINA and p.BDGA_CODIBODE = c.SECC_CODIBODE and p.CODISECC = c.SECC_CODISECC)
union all
select 'SYSTEM' as child_owner, 'ALM_PROYPROD' as child_table, 'PRPD_BDGA_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_BODEGAS' as parent_table, 3 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_PROYPROD c where c.BDGA_CODIBODE is not null and c.BDGA_OFCN_COMPANIA is not null and c.BDGA_OFCN_OFICINA is not null and not exists (select 1 from SYSTEM.ALM_BODEGAS p where p.CODIBODE = c.BDGA_CODIBODE and p.OFCN_COMPANIA = c.BDGA_OFCN_COMPANIA and p.OFCN_OFICINA = c.BDGA_OFCN_OFICINA)
union all
select 'SYSTEM' as child_owner, 'ALM_TMPDETALOTE' as child_table, 'TDLT_DPR_FK' as fk_name, 'SYSTEM' as parent_owner, 'VEN_DETAPROD' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_TMPDETALOTE c where c.DPR_DPR_ID is not null and not exists (select 1 from SYSTEM.VEN_DETAPROD p where p.DPR_ID = c.DPR_DPR_ID)
union all
select 'SYSTEM' as child_owner, 'ALM_TMPDETALOTE' as child_table, 'TDLT_DXML_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_TMPDETAMOVI' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_TMPDETALOTE c where c.DXML_DXML_ID is not null and not exists (select 1 from SYSTEM.ALM_TMPDETAMOVI p where p.DXML_ID = c.DXML_DXML_ID)
union all
select 'SYSTEM' as child_owner, 'ALM_TMPDETALOTE' as child_table, 'TDLT_LOTE_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_LOTE' as parent_table, 3 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_TMPDETALOTE c where c.LOTE_COMPANIA is not null and c.LOTE_NUMELOTE is not null and c.LOTE_ALCANCE is not null and not exists (select 1 from SYSTEM.ALM_LOTE p where p.CMPN_COMPANIA = c.LOTE_COMPANIA and p.NUMELOTE = c.LOTE_NUMELOTE and p.ALCANCE = c.LOTE_ALCANCE)
union all
select 'SYSTEM' as child_owner, 'ALM_TMPDETAMOVI' as child_table, 'DXML_CXML_FK' as fk_name, 'SYSTEM' as parent_owner, 'COM_TMPCOMPRAS' as parent_table, 5 as fk_columns, count(*) as orphan_count from SYSTEM.ALM_TMPDETAMOVI c where c.CMPR_SERIE is not null and c.CMPR_NUMERO is not null and c.CMPR_CEDURUC is not null and c.CMPR_ALCANCE is not null and c.CMPR_COMPANIA is not null and not exists (select 1 from SYSTEM.COM_TMPCOMPRAS p where p.SERIE = c.CMPR_SERIE and p.NUMERO = c.CMPR_NUMERO and p.PROV_CEDURUC = c.CMPR_CEDURUC and p.ALCANCE = c.CMPR_ALCANCE and p.PROV_COMPANIA = c.CMPR_COMPANIA)
union all
select 'SYSTEM' as child_owner, 'CLI_DETALINE' as child_table, 'DTLN_LNCR_FK' as fk_name, 'SYSTEM' as parent_owner, 'CLI_LINECRED' as parent_table, 2 as fk_columns, count(*) as orphan_count from SYSTEM.CLI_DETALINE c where c.LNCR_COMPANIA is not null and c.LNCR_IDCLIENTE is not null and not exists (select 1 from SYSTEM.CLI_LINECRED p where p.CLTE_COMPANIA = c.LNCR_COMPANIA and p.CLTE_IDCLIENTE = c.LNCR_IDCLIENTE)
union all
select 'SYSTEM' as child_owner, 'CNT_DETASIENTO' as child_table, 'DAST_CCST_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_CENTCOST' as parent_table, 3 as fk_columns, count(*) as orphan_count from SYSTEM.CNT_DETASIENTO c where c.CCST_COMPANIA is not null and c.CCST_OFICINA is not null and c.CCST_CODIGO is not null and not exists (select 1 from SYSTEM.GEN_CENTCOST p where p.OFCN_COMPANIA = c.CCST_COMPANIA and p.OFCN_OFICINA = c.CCST_OFICINA and p.CODIGO = c.CCST_CODIGO)
union all
select 'SYSTEM' as child_owner, 'CNT_DETASIENTO' as child_table, 'DAST_CTAS_FK' as fk_name, 'SYSTEM' as parent_owner, 'CNT_CUENTAS' as parent_table, 3 as fk_columns, count(*) as orphan_count from SYSTEM.CNT_DETASIENTO c where c.CTAS_COMPANIA is not null and c.CTAS_CATALOGO is not null and c.CTAS_CODIGO is not null and not exists (select 1 from SYSTEM.CNT_CUENTAS p where p.CTLG_COMPANIA = c.CTAS_COMPANIA and p.CTLG_CATALOGO = c.CTAS_CATALOGO and p.CODIGO = c.CTAS_CODIGO)
union all
select 'SYSTEM' as child_owner, 'CNT_DETASIENTO' as child_table, 'DAST_DAST_FK' as fk_name, 'SYSTEM' as parent_owner, 'CNT_DETASIENTO' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.CNT_DETASIENTO c where c.DAST_DAST_ID is not null and not exists (select 1 from SYSTEM.CNT_DETASIENTO p where p.DAST_ID = c.DAST_DAST_ID)
union all
select 'SYSTEM' as child_owner, 'CNT_DETIPIMP' as child_table, 'DTIP_TPIM_FK' as fk_name, 'SYSTEM' as parent_owner, 'CNT_TIPOIMPU' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.CNT_DETIPIMP c where c.TPIM_TIPOIMPU is not null and not exists (select 1 from SYSTEM.CNT_TIPOIMPU p where p.TIPOIMPU = c.TPIM_TIPOIMPU)
union all
select 'SYSTEM' as child_owner, 'COB_DETACHEQ' as child_table, 'DCHE_CHQE_FK' as fk_name, 'SYSTEM' as parent_owner, 'CAJ_CHEQUES' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.COB_DETACHEQ c where c.CHQE_CHQE_ID is not null and not exists (select 1 from SYSTEM.CAJ_CHEQUES p where p.CHQE_ID = c.CHQE_CHQE_ID)
union all
select 'SYSTEM' as child_owner, 'COB_DETACHEQ' as child_table, 'DCHE_EGEN_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_ESTADOS' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.COB_DETACHEQ c where c.EGEN_ESTADO is not null and not exists (select 1 from SYSTEM.GEN_ESTADOS p where p.ESTADO = c.EGEN_ESTADO)
union all
select 'SYSTEM' as child_owner, 'COB_DETACHEQ' as child_table, 'DCHE_PLCB_FK' as fk_name, 'SYSTEM' as parent_owner, 'VEN_PLANCOBR' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.COB_DETACHEQ c where c.PLCB_PLCB_ID is not null and not exists (select 1 from SYSTEM.VEN_PLANCOBR p where p.PLCB_ID = c.PLCB_PLCB_ID)
union all
select 'SYSTEM' as child_owner, 'COB_DETACOBRO' as child_table, 'DTCB_ASTO_FK' as fk_name, 'SYSTEM' as parent_owner, 'CNT_ASIENTO' as parent_table, 2 as fk_columns, count(*) as orphan_count from SYSTEM.COB_DETACOBRO c where c.ASTO_COMPANIA is not null and c.ASTO_NUMEDIAR is not null and not exists (select 1 from SYSTEM.CNT_ASIENTO p where p.CMPN_COMPANIA = c.ASTO_COMPANIA and p.NUMEDIAR = c.ASTO_NUMEDIAR)
union all
select 'SYSTEM' as child_owner, 'COB_DETACOBRO' as child_table, 'DTCB_EGEN_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_ESTADOS' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.COB_DETACOBRO c where c.EGEN_ESTADO is not null and not exists (select 1 from SYSTEM.GEN_ESTADOS p where p.ESTADO = c.EGEN_ESTADO)
union all
select 'SYSTEM' as child_owner, 'COB_DETACOBRO' as child_table, 'DTCB_NCCL_FK' as fk_name, 'SYSTEM' as parent_owner, 'VEN_NOTACRED' as parent_table, 4 as fk_columns, count(*) as orphan_count from SYSTEM.COB_DETACOBRO c where c.NCCL_COMPANIA is not null and c.NCCL_OFICINA is not null and c.NCCL_SERIE is not null and c.NCCL_NUMERO is not null and not exists (select 1 from SYSTEM.VEN_NOTACRED p where p.OFCN_COMPANIA = c.NCCL_COMPANIA and p.OFCN_OFICINA = c.NCCL_OFICINA and p.SERIE = c.NCCL_SERIE and p.NUMERO = c.NCCL_NUMERO)
union all
select 'SYSTEM' as child_owner, 'COB_DETACOBRO' as child_table, 'DTCB_PLCB_FK' as fk_name, 'SYSTEM' as parent_owner, 'VEN_PLANCOBR' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.COB_DETACOBRO c where c.PLCB_PLCB_ID is not null and not exists (select 1 from SYSTEM.VEN_PLANCOBR p where p.PLCB_ID = c.PLCB_PLCB_ID)
union all
select 'SYSTEM' as child_owner, 'COB_DETACOBRO' as child_table, 'DTCB_PTBN_FK' as fk_name, 'SYSTEM' as parent_owner, 'PRT_TRANSBANCA' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.COB_DETACOBRO c where c.PTBN_NUMEOPER is not null and not exists (select 1 from SYSTEM.PRT_TRANSBANCA p where p.NUMEOPER = c.PTBN_NUMEOPER)
union all
select 'SYSTEM' as child_owner, 'COB_DETACOBRO' as child_table, 'DTCB_RCCB_FK' as fk_name, 'SYSTEM' as parent_owner, 'COB_RECICOBR' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.COB_DETACOBRO c where c.RCCB_NUMERO is not null and not exists (select 1 from SYSTEM.COB_RECICOBR p where p.NUMERO = c.RCCB_NUMERO)
union all
select 'SYSTEM' as child_owner, 'COB_DETACOBRO' as child_table, 'DTCB_VNDR_FK' as fk_name, 'SYSTEM' as parent_owner, 'VEN_VENDCOBR' as parent_table, 3 as fk_columns, count(*) as orphan_count from SYSTEM.COB_DETACOBRO c where c.VNDR_COMPANIA is not null and c.VNDR_OFICINA is not null and c.VNDR_CODIGO is not null and not exists (select 1 from SYSTEM.VEN_VENDCOBR p where p.OFCN_COMPANIA = c.VNDR_COMPANIA and p.OFCN_OFICINA = c.VNDR_OFICINA and p.CODIGO = c.VNDR_CODIGO)
union all
select 'SYSTEM' as child_owner, 'COB_DETADEBI' as child_table, 'DDEB_OTRC_FK' as fk_name, 'SYSTEM' as parent_owner, 'COB_OTRODEBI' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.COB_DETADEBI c where c.OTRC_OTRC_ID is not null and not exists (select 1 from SYSTEM.COB_OTRODEBI p where p.OTRC_ID = c.OTRC_OTRC_ID)
union all
select 'SYSTEM' as child_owner, 'COM_DETASOLI' as child_table, 'DSOL_DTMV_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_DETAMOVI' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.COM_DETASOLI c where c.DTMV_DTMV_ID is not null and not exists (select 1 from SYSTEM.ALM_DETAMOVI p where p.DTMV_ID = c.DTMV_DTMV_ID)
union all
select 'SYSTEM' as child_owner, 'COM_DETASOLI' as child_table, 'DSOL_SCOM_FK' as fk_name, 'SYSTEM' as parent_owner, 'COM_SOLICOMP' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.COM_DETASOLI c where c.SCOM_SCOM_ID is not null and not exists (select 1 from SYSTEM.COM_SOLICOMP p where p.SCOM_ID = c.SCOM_SCOM_ID)
union all
select 'SYSTEM' as child_owner, 'COM_PLANPAGO' as child_table, 'PPAG_EGEN_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_ESTADOS' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.COM_PLANPAGO c where c.EGEN_ESTADO is not null and not exists (select 1 from SYSTEM.GEN_ESTADOS p where p.ESTADO = c.EGEN_ESTADO)
union all
select 'SYSTEM' as child_owner, 'COM_PLANPAGO' as child_table, 'PPAG_OTRS_FK' as fk_name, 'SYSTEM' as parent_owner, 'PAG_OTRSCTAS' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.COM_PLANPAGO c where c.OTRS_OTRS_ID is not null and not exists (select 1 from SYSTEM.PAG_OTRSCTAS p where p.OTRS_ID = c.OTRS_OTRS_ID)
union all
select 'SYSTEM' as child_owner, 'COM_TMPCOMPRAS' as child_table, 'CXML_EGEN_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_ESTADOS' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.COM_TMPCOMPRAS c where c.EGEN_ESTADO is not null and not exists (select 1 from SYSTEM.GEN_ESTADOS p where p.ESTADO = c.EGEN_ESTADO)
union all
select 'SYSTEM' as child_owner, 'COM_TMPCOMPRAS' as child_table, 'CXML_FRPG_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_FORMPAGO' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.COM_TMPCOMPRAS c where c.FRPG_FORMPAGO is not null and not exists (select 1 from SYSTEM.GEN_FORMPAGO p where p.FORMPAGO = c.FRPG_FORMPAGO)
union all
select 'SYSTEM' as child_owner, 'COM_TMPCOMPRAS' as child_table, 'CXML_INCN_FK' as fk_name, 'SYSTEM' as parent_owner, 'CNT_INTECONT' as parent_table, 4 as fk_columns, count(*) as orphan_count from SYSTEM.COM_TMPCOMPRAS c where c.INCN_COMPANIA is not null and c.INCN_PRODUCTO is not null and c.INCN_TIPODOCU is not null and c.INCN_CODITRAN is not null and not exists (select 1 from SYSTEM.CNT_INTECONT p where p.CMPN_COMPANIA = c.INCN_COMPANIA and p.PRDT_PRODUCTO = c.INCN_PRODUCTO and p.TPDC_TIPODOCU = c.INCN_TIPODOCU and p.CODITRAN = c.INCN_CODITRAN)
union all
select 'SYSTEM' as child_owner, 'COM_TMPCOMPRAS' as child_table, 'CXML_MONE_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_MONEDA' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.COM_TMPCOMPRAS c where c.MONE_MONEDA is not null and not exists (select 1 from SYSTEM.GEN_MONEDA p where p.MONEDA = c.MONE_MONEDA)
union all
select 'SYSTEM' as child_owner, 'COM_TMPCOMPRAS' as child_table, 'CXML_PAIS_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_PAIS' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.COM_TMPCOMPRAS c where c.PAIS_CODIPAIS is not null and not exists (select 1 from SYSTEM.GEN_PAIS p where p.CODIPAIS = c.PAIS_CODIPAIS)
union all
select 'SYSTEM' as child_owner, 'COM_TMPCOMPRAS' as child_table, 'CXML_PRPG_DEFINIENDO_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_PERIPAGO' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.COM_TMPCOMPRAS c where c.PRPG_CODIPERI is not null and not exists (select 1 from SYSTEM.GEN_PERIPAGO p where p.CODIPERI = c.PRPG_CODIPERI)
union all
select 'SYSTEM' as child_owner, 'COM_TMPCOMPRAS' as child_table, 'CXML_SCTR_FK' as fk_name, 'SYSTEM' as parent_owner, 'CNT_SECUTRAN' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.COM_TMPCOMPRAS c where c.SCTR_SECUTRAN is not null and not exists (select 1 from SYSTEM.CNT_SECUTRAN p where p.SECUTRAN = c.SCTR_SECUTRAN)
union all
select 'SYSTEM' as child_owner, 'COM_TMPCOMPRAS' as child_table, 'CXML_STCM_FK' as fk_name, 'SYSTEM' as parent_owner, 'CNT_SUSTCOMP' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.COM_TMPCOMPRAS c where c.STCM_SUSTENTO is not null and not exists (select 1 from SYSTEM.CNT_SUSTCOMP p where p.SUSTENTO = c.STCM_SUSTENTO)
union all
select 'SYSTEM' as child_owner, 'COM_TMPCOMPRAS' as child_table, 'CXML_TPPG_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_TIPOPAGO' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.COM_TMPCOMPRAS c where c.TPPG_CODIGO is not null and not exists (select 1 from SYSTEM.GEN_TIPOPAGO p where p.CODIGO = c.TPPG_CODIGO)
union all
select 'SYSTEM' as child_owner, 'CST_DETARECT' as child_table, 'DTRC_RCTA_FK' as fk_name, 'SYSTEM' as parent_owner, 'CST_RECETA' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.CST_DETARECT c where c.RCTA_ID is not null and not exists (select 1 from SYSTEM.CST_RECETA p where p.RCTA_ID = c.RCTA_ID)
union all
select 'SYSTEM' as child_owner, 'CST_DETCENCS' as child_table, 'DTCC_LTPR_FK' as fk_name, 'SYSTEM' as parent_owner, 'CST_LOTEPRO' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.CST_DETCENCS c where c.LTPR_CODIGO is not null and not exists (select 1 from SYSTEM.CST_LOTEPRO p where p.CODIGO = c.LTPR_CODIGO)
union all
select 'SYSTEM' as child_owner, 'CST_ORDEPROD' as child_table, 'OPRD_ASTO_FK' as fk_name, 'SYSTEM' as parent_owner, 'CNT_ASIENTO' as parent_table, 2 as fk_columns, count(*) as orphan_count from SYSTEM.CST_ORDEPROD c where c.ASTO_COMPANIA is not null and c.ASTO_NUMEDIAR is not null and not exists (select 1 from SYSTEM.CNT_ASIENTO p where p.CMPN_COMPANIA = c.ASTO_COMPANIA and p.NUMEDIAR = c.ASTO_NUMEDIAR)
union all
select 'SYSTEM' as child_owner, 'CST_ORDEPROD' as child_table, 'OPRD_EGEN_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_ESTADOS' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.CST_ORDEPROD c where c.EGEN_ESTADO is not null and not exists (select 1 from SYSTEM.GEN_ESTADOS p where p.ESTADO = c.EGEN_ESTADO)
union all
select 'SYSTEM' as child_owner, 'CST_ORDEPROD' as child_table, 'OPRD_LTPR_FK' as fk_name, 'SYSTEM' as parent_owner, 'CST_LOTEPRO' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.CST_ORDEPROD c where c.LTPR_CODIGO is not null and not exists (select 1 from SYSTEM.CST_LOTEPRO p where p.CODIGO = c.LTPR_CODIGO)
union all
select 'SYSTEM' as child_owner, 'CST_ORDEPROD' as child_table, 'OPRD_RCTA_FK' as fk_name, 'SYSTEM' as parent_owner, 'CST_RECETA' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.CST_ORDEPROD c where c.RCTA_ID is not null and not exists (select 1 from SYSTEM.CST_RECETA p where p.RCTA_ID = c.RCTA_ID)
union all
select 'SYSTEM' as child_owner, 'CST_SIMUDETA' as child_table, 'DSIM_SIMU_FK' as fk_name, 'SYSTEM' as parent_owner, 'CST_SIMUCABE' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.CST_SIMUDETA c where c.SIMU_SIMU_ID is not null and not exists (select 1 from SYSTEM.CST_SIMUCABE p where p.SIMU_ID = c.SIMU_SIMU_ID)
union all
select 'SYSTEM' as child_owner, 'CST_VARIPROD' as child_table, 'VARP_VARP_FK' as fk_name, 'SYSTEM' as parent_owner, 'CST_VARIPROD' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.CST_VARIPROD c where c.VARP_VARP_ID is not null and not exists (select 1 from SYSTEM.CST_VARIPROD p where p.VARP_ID = c.VARP_VARP_ID)
union all
select 'SYSTEM' as child_owner, 'ECL_DETAFORMU' as child_table, 'DTFR_DTFR_FK' as fk_name, 'SYSTEM' as parent_owner, 'ECL_DETAFORMU' as parent_table, 2 as fk_columns, count(*) as orphan_count from SYSTEM.ECL_DETAFORMU c where c.DTFR_CODICAMP is not null and c.DTFR_CODIGO is not null and not exists (select 1 from SYSTEM.ECL_DETAFORMU p where p.CODICAMP = c.DTFR_CODICAMP and p.FRML_CODIGO = c.DTFR_CODIGO)
union all
select 'SYSTEM' as child_owner, 'ECL_DETAFORMU' as child_table, 'DTFR_FRML_FK' as fk_name, 'SYSTEM' as parent_owner, 'ECL_FORMULARIO' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.ECL_DETAFORMU c where c.FRML_CODIGO is not null and not exists (select 1 from SYSTEM.ECL_FORMULARIO p where p.CODIGO = c.FRML_CODIGO)
union all
select 'SYSTEM' as child_owner, 'ECT_DETADECLA' as child_table, 'DTDC_DTFR_FK' as fk_name, 'SYSTEM' as parent_owner, 'ECL_DETAFORMU' as parent_table, 2 as fk_columns, count(*) as orphan_count from SYSTEM.ECT_DETADECLA c where c.DTFR_CODICAMP is not null and c.DTFR_CODIGO is not null and not exists (select 1 from SYSTEM.ECL_DETAFORMU p where p.CODICAMP = c.DTFR_CODICAMP and p.FRML_CODIGO = c.DTFR_CODIGO)
union all
select 'SYSTEM' as child_owner, 'GEN_PERIPAGO' as child_table, 'PRPG_FRPG_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_FORMPAGO' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.GEN_PERIPAGO c where c.FRPG_FORMPAGO is not null and not exists (select 1 from SYSTEM.GEN_FORMPAGO p where p.FORMPAGO = c.FRPG_FORMPAGO)
union all
select 'SYSTEM' as child_owner, 'IMP_DENOTAPEDI' as child_table, 'DTNP_DREQ_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_DETAREQU' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.IMP_DENOTAPEDI c where c.DREQ_DREQ_ID is not null and not exists (select 1 from SYSTEM.ALM_DETAREQU p where p.DREQ_ID = c.DREQ_DREQ_ID)
union all
select 'SYSTEM' as child_owner, 'IMP_DENOTAPEDI' as child_table, 'DTNP_DTNP_FK' as fk_name, 'SYSTEM' as parent_owner, 'IMP_DENOTAPEDI' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.IMP_DENOTAPEDI c where c.DTNP_DTNP_ID is not null and not exists (select 1 from SYSTEM.IMP_DENOTAPEDI p where p.DTNP_ID = c.DTNP_DTNP_ID)
union all
select 'SYSTEM' as child_owner, 'IMP_DENOTAPEDI' as child_table, 'DTNP_NTPD_FK' as fk_name, 'SYSTEM' as parent_owner, 'IMP_NOTAPEDI' as parent_table, 3 as fk_columns, count(*) as orphan_count from SYSTEM.IMP_DENOTAPEDI c where c.NTPD_COMPANIA is not null and c.NTPD_OFICINA is not null and c.NTPD_NUMERO is not null and not exists (select 1 from SYSTEM.IMP_NOTAPEDI p where p.OFCN_COMPANIA = c.NTPD_COMPANIA and p.OFCN_OFICINA = c.NTPD_OFICINA and p.NUMERO = c.NTPD_NUMERO)
union all
select 'SYSTEM' as child_owner, 'IMP_NOTAPEDI' as child_table, 'NTPD_ASGR_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_ASEGURADORA' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.IMP_NOTAPEDI c where c.ASGR_ASGR_ID is not null and not exists (select 1 from SYSTEM.GEN_ASEGURADORA p where p.ASGR_ID = c.ASGR_ASGR_ID)
union all
select 'SYSTEM' as child_owner, 'IMP_NOTAPEDI' as child_table, 'NTPD_CBAN_FK' as fk_name, 'SYSTEM' as parent_owner, 'BAN_CTABANCARIA' as parent_table, 3 as fk_columns, count(*) as orphan_count from SYSTEM.IMP_NOTAPEDI c where c.CBAN_COMPANIA is not null and c.CBAN_CATALOGO is not null and c.CBAN_CODIGO is not null and not exists (select 1 from SYSTEM.BAN_CTABANCARIA p where p.CTAS_COMPANIA = c.CBAN_COMPANIA and p.CTAS_CATALOGO = c.CBAN_CATALOGO and p.CTAS_CODIGO = c.CBAN_CODIGO)
union all
select 'SYSTEM' as child_owner, 'IMP_NOTAPEDI' as child_table, 'NTPD_EGEN_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_ESTADOS' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.IMP_NOTAPEDI c where c.EGEN_ESTADO is not null and not exists (select 1 from SYSTEM.GEN_ESTADOS p where p.ESTADO = c.EGEN_ESTADO)
union all
select 'SYSTEM' as child_owner, 'IMP_NOTAPEDI' as child_table, 'NTPD_IMPT_FK' as fk_name, 'SYSTEM' as parent_owner, 'IMP_IMPORTAC' as parent_table, 3 as fk_columns, count(*) as orphan_count from SYSTEM.IMP_NOTAPEDI c where c.IMPT_COMPANIA is not null and c.IMPT_OFICINA is not null and c.IMPT_NUMEIMPO is not null and not exists (select 1 from SYSTEM.IMP_IMPORTAC p where p.OFCN_COMPANIA = c.IMPT_COMPANIA and p.OFCN_OFICINA = c.IMPT_OFICINA and p.NUMEIMPO = c.IMPT_NUMEIMPO)
union all
select 'SYSTEM' as child_owner, 'IMP_NOTAPEDI' as child_table, 'NTPD_MONE_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_MONEDA' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.IMP_NOTAPEDI c where c.MONE_MONEDA is not null and not exists (select 1 from SYSTEM.GEN_MONEDA p where p.MONEDA = c.MONE_MONEDA)
union all
select 'SYSTEM' as child_owner, 'IMP_NOTAPEDI' as child_table, 'NTPD_NTPD_FK' as fk_name, 'SYSTEM' as parent_owner, 'IMP_NOTAPEDI' as parent_table, 3 as fk_columns, count(*) as orphan_count from SYSTEM.IMP_NOTAPEDI c where c.NTPD_COMPANIA is not null and c.NTPD_OFICINA is not null and c.NTPD_NUMERO is not null and not exists (select 1 from SYSTEM.IMP_NOTAPEDI p where p.OFCN_COMPANIA = c.NTPD_COMPANIA and p.OFCN_OFICINA = c.NTPD_OFICINA and p.NUMERO = c.NTPD_NUMERO)
union all
select 'SYSTEM' as child_owner, 'IMP_NOTAPEDI' as child_table, 'NTPD_REQU_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_REQUERIM' as parent_table, 4 as fk_columns, count(*) as orphan_count from SYSTEM.IMP_NOTAPEDI c where c.REQU_NUMERO is not null and c.REQU_COMPANIA is not null and c.REQU_OFICINA is not null and c.REQU_TIPODOCU is not null and not exists (select 1 from SYSTEM.ALM_REQUERIM p where p.NUMERO = c.REQU_NUMERO and p.OFCN_COMPANIA = c.REQU_COMPANIA and p.OFCN_OFICINA = c.REQU_OFICINA and p.TPDC_TIPODOCU = c.REQU_TIPODOCU)
union all
select 'SYSTEM' as child_owner, 'IMP_NOTAPEDI' as child_table, 'NTPD_UMED_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_UNIDMEDI' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.IMP_NOTAPEDI c where c.UMED_UNIDMEDI is not null and not exists (select 1 from SYSTEM.ALM_UNIDMEDI p where p.UNIDMEDI = c.UMED_UNIDMEDI)
union all
select 'SYSTEM' as child_owner, 'INF_DETAEQUI' as child_table, 'INDE_EGEN_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_ESTADOS' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.INF_DETAEQUI c where c.EGEN_ESTADO is not null and not exists (select 1 from SYSTEM.GEN_ESTADOS p where p.ESTADO = c.EGEN_ESTADO)
union all
select 'SYSTEM' as child_owner, 'PAG_DETAPAGO' as child_table, 'DPAG_ASTO_FK' as fk_name, 'SYSTEM' as parent_owner, 'CNT_ASIENTO' as parent_table, 2 as fk_columns, count(*) as orphan_count from SYSTEM.PAG_DETAPAGO c where c.ASTO_COMPANIA is not null and c.ASTO_NUMEDIAR is not null and not exists (select 1 from SYSTEM.CNT_ASIENTO p where p.CMPN_COMPANIA = c.ASTO_COMPANIA and p.NUMEDIAR = c.ASTO_NUMEDIAR)
union all
select 'SYSTEM' as child_owner, 'PAG_DETAPAGO' as child_table, 'DPAG_EGEN_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_ESTADOS' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.PAG_DETAPAGO c where c.EGEN_ESTADO is not null and not exists (select 1 from SYSTEM.GEN_ESTADOS p where p.ESTADO = c.EGEN_ESTADO)
union all
select 'SYSTEM' as child_owner, 'PAG_DETAPAGO' as child_table, 'DPAG_NCPR_FK' as fk_name, 'SYSTEM' as parent_owner, 'COM_NOTACREDI' as parent_table, 5 as fk_columns, count(*) as orphan_count from SYSTEM.PAG_DETAPAGO c where c.NCPR_COMPANIA is not null and c.NCPR_CEDURUC is not null and c.NCPR_SERIE is not null and c.NCPR_NUMERO is not null and c.NCPR_ALCANCE is not null and not exists (select 1 from SYSTEM.COM_NOTACREDI p where p.PROV_COMPANIA = c.NCPR_COMPANIA and p.PROV_CEDURUC = c.NCPR_CEDURUC and p.SERIE = c.NCPR_SERIE and p.NUMERO = c.NCPR_NUMERO and p.ALCANCE = c.NCPR_ALCANCE)
union all
select 'SYSTEM' as child_owner, 'PAG_DETAPAGO' as child_table, 'DPAG_PPAG_FK' as fk_name, 'SYSTEM' as parent_owner, 'COM_PLANPAGO' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.PAG_DETAPAGO c where c.PPAG_PPAG_ID is not null and not exists (select 1 from SYSTEM.COM_PLANPAGO p where p.PPAG_ID = c.PPAG_PPAG_ID)
union all
select 'SYSTEM' as child_owner, 'PRT_DETASIENTO' as child_table, 'PDAS_GPCM_FK' as fk_name, 'SYSTEM' as parent_owner, 'PRT_GRUPOSCOM' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.PRT_DETASIENTO c where c.GPCM_CODIGRUP is not null and not exists (select 1 from SYSTEM.PRT_GRUPOSCOM p where p.CODIGRUP = c.GPCM_CODIGRUP)
union all
select 'SYSTEM' as child_owner, 'PRT_DETASIENTO' as child_table, 'PDAS_PCTS_FK' as fk_name, 'SYSTEM' as parent_owner, 'PRT_CUENTAS' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.PRT_DETASIENTO c where c.PCTS_CODIGO is not null and not exists (select 1 from SYSTEM.PRT_CUENTAS p where p.CODIGO = c.PCTS_CODIGO)
union all
select 'SYSTEM' as child_owner, 'PRT_DETASIENTO' as child_table, 'PDAS_PTBN_FK' as fk_name, 'SYSTEM' as parent_owner, 'PRT_TRANSBANCA' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.PRT_DETASIENTO c where c.PTBN_NUMEOPER is not null and not exists (select 1 from SYSTEM.PRT_TRANSBANCA p where p.NUMEOPER = c.PTBN_NUMEOPER)
union all
select 'SYSTEM' as child_owner, 'PRT_DETASOLI' as child_table, 'PDSL_ESOL_FK' as fk_name, 'SYSTEM' as parent_owner, 'CLI_ESTADSOLIC' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.PRT_DETASOLI c where c.ESOL_ESTADO is not null and not exists (select 1 from SYSTEM.CLI_ESTADSOLIC p where p.ESTADO = c.ESOL_ESTADO)
union all
select 'SYSTEM' as child_owner, 'PRT_DETASOLI' as child_table, 'PDSL_PCRG_FK' as fk_name, 'SYSTEM' as parent_owner, 'PRT_CARGO' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.PRT_DETASOLI c where c.PCRG_TIPO is not null and not exists (select 1 from SYSTEM.PRT_CARGO p where p.TIPO = c.PCRG_TIPO)
union all
select 'SYSTEM' as child_owner, 'PRT_DETASOLI' as child_table, 'PDSL_PRTC_FK' as fk_name, 'SYSTEM' as parent_owner, 'PRT_TIPOCREDI' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.PRT_DETASOLI c where c.PRTC_TIPOCRED is not null and not exists (select 1 from SYSTEM.PRT_TIPOCREDI p where p.TIPOCRED = c.PRTC_TIPOCRED)
union all
select 'SYSTEM' as child_owner, 'PRT_DETASOLI' as child_table, 'PDSL_PSLG_FK' as fk_name, 'SYSTEM' as parent_owner, 'PRT_SOLIGRUP' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.PRT_DETASOLI c where c.PSLG_NUMERO is not null and not exists (select 1 from SYSTEM.PRT_SOLIGRUP p where p.NUMERO = c.PSLG_NUMERO)
union all
select 'SYSTEM' as child_owner, 'PRT_DETASOLI' as child_table, 'PDSL_TPDC_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_TIPODOCU' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.PRT_DETASOLI c where c.TPDC_TIPODOCU is not null and not exists (select 1 from SYSTEM.GEN_TIPODOCU p where p.TIPODOCU = c.TPDC_TIPODOCU)
union all
select 'SYSTEM' as child_owner, 'PRT_DETIPCAU' as child_table, 'DCSL_PCTS_FK' as fk_name, 'SYSTEM' as parent_owner, 'PRT_CUENTAS' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.PRT_DETIPCAU c where c.PCTS_CODIGO is not null and not exists (select 1 from SYSTEM.PRT_CUENTAS p where p.CODIGO = c.PCTS_CODIGO)
union all
select 'SYSTEM' as child_owner, 'PRT_DETIPCAU' as child_table, 'DCSL_TCSL_FK' as fk_name, 'SYSTEM' as parent_owner, 'PRT_TIPOCAUSAL' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.PRT_DETIPCAU c where c.TCSL_TIPCASUA is not null and not exists (select 1 from SYSTEM.PRT_TIPOCAUSAL p where p.TIPCASUA = c.TCSL_TIPCASUA)
union all
select 'SYSTEM' as child_owner, 'PRT_DETIPCAU' as child_table, 'DCSL_TPDC_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_TIPODOCU' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.PRT_DETIPCAU c where c.TPDC_TIPODOCU is not null and not exists (select 1 from SYSTEM.GEN_TIPODOCU p where p.TIPODOCU = c.TPDC_TIPODOCU)
union all
select 'SYSTEM' as child_owner, 'PRT_SIMUDETA' as child_table, 'SDET_CCPT_FK' as fk_name, 'SYSTEM' as parent_owner, 'PRT_CLASCAPI' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.PRT_SIMUDETA c where c.CCPT_TIPOCAPI is not null and not exists (select 1 from SYSTEM.PRT_CLASCAPI p where p.TIPOCAPI = c.CCPT_TIPOCAPI)
union all
select 'SYSTEM' as child_owner, 'PRT_SIMUDETA' as child_table, 'SDET_EGEN_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_ESTADOS' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.PRT_SIMUDETA c where c.EGEN_ESTADO is not null and not exists (select 1 from SYSTEM.GEN_ESTADOS p where p.ESTADO = c.EGEN_ESTADO)
union all
select 'SYSTEM' as child_owner, 'PRT_SIMUDETA' as child_table, 'SDET_FRPG_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_FORMPAGO' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.PRT_SIMUDETA c where c.FRPG_FORMPAGO is not null and not exists (select 1 from SYSTEM.GEN_FORMPAGO p where p.FORMPAGO = c.FRPG_FORMPAGO)
union all
select 'SYSTEM' as child_owner, 'PRT_SIMUDETA' as child_table, 'SDET_SMCR_FK' as fk_name, 'SYSTEM' as parent_owner, 'PRT_SIMUCRED' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.PRT_SIMUDETA c where c.SMCR_SMCR_ID is not null and not exists (select 1 from SYSTEM.PRT_SIMUCRED p where p.SMCR_ID = c.SMCR_SMCR_ID)
union all
select 'SYSTEM' as child_owner, 'RHH_DETAPRES' as child_table, 'DPRS_PRS_FK' as fk_name, 'SYSTEM' as parent_owner, 'RHH_PRESUPUESTO' as parent_table, 3 as fk_columns, count(*) as orphan_count from SYSTEM.RHH_DETAPRES c where c.PRS_NUMERO is not null and c.PRS_COMPANIA is not null and c.PRS_OFICINA is not null and not exists (select 1 from SYSTEM.RHH_PRESUPUESTO p where p.NUMERO = c.PRS_NUMERO and p.OFCN_COMPANIA = c.PRS_COMPANIA and p.OFCN_OFICINA = c.PRS_OFICINA)
union all
select 'SYSTEM' as child_owner, 'RHH_DETAVENC' as child_table, 'CUOTAS_ASTO_FK' as fk_name, 'SYSTEM' as parent_owner, 'CNT_ASIENTO' as parent_table, 2 as fk_columns, count(*) as orphan_count from SYSTEM.RHH_DETAVENC c where c.ASTO_CMPN_COMPANIA is not null and c.ASTO_NUMEDIAR is not null and not exists (select 1 from SYSTEM.CNT_ASIENTO p where p.CMPN_COMPANIA = c.ASTO_CMPN_COMPANIA and p.NUMEDIAR = c.ASTO_NUMEDIAR)
union all
select 'SYSTEM' as child_owner, 'RHH_DETAVENC' as child_table, 'CUOTAS_EGEN_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_ESTADOS' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.RHH_DETAVENC c where c.EGEN_ESTADO is not null and not exists (select 1 from SYSTEM.GEN_ESTADOS p where p.ESTADO = c.EGEN_ESTADO)
union all
select 'SYSTEM' as child_owner, 'RHH_DETAVENC' as child_table, 'CUOTAS_VNCT_FK' as fk_name, 'SYSTEM' as parent_owner, 'RHH_VENCIMIEN' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.RHH_DETAVENC c where c.VNCT_ID is not null and not exists (select 1 from SYSTEM.RHH_VENCIMIEN p where p.VNCT_ID = c.VNCT_ID)
union all
select 'SYSTEM' as child_owner, 'RHH_PAGOVACA' as child_table, 'PGVC_EGEN_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_ESTADOS' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.RHH_PAGOVACA c where c.EGEN_ESTADO is not null and not exists (select 1 from SYSTEM.GEN_ESTADOS p where p.ESTADO = c.EGEN_ESTADO)
union all
select 'SYSTEM' as child_owner, 'RHH_PAGOVACA' as child_table, 'PGVC_PRVN_FK' as fk_name, 'SYSTEM' as parent_owner, 'RHH_PROVICION' as parent_table, 3 as fk_columns, count(*) as orphan_count from SYSTEM.RHH_PAGOVACA c where c.PRVN_FECHA is not null and c.PRVN_CODIPROV is not null and c.PRVN_CEDURUC is not null and not exists (select 1 from SYSTEM.RHH_PROVICION p where p.FECHA = c.PRVN_FECHA and p.TPPR_CODIPROV = c.PRVN_CODIPROV and p.RHHS_CEDURUC = c.PRVN_CEDURUC)
union all
select 'SYSTEM' as child_owner, 'SEG_PRODUSUA' as child_table, 'PDUS_PRDT_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_PRODUCTOS' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.SEG_PRODUSUA c where c.PRDT_PRODUCTO is not null and not exists (select 1 from SYSTEM.GEN_PRODUCTOS p where p.PRODUCTO = c.PRDT_PRODUCTO)
union all
select 'SYSTEM' as child_owner, 'SEG_PRODUSUA' as child_table, 'PDUS_USUA_FK' as fk_name, 'SYSTEM' as parent_owner, 'SEG_USUARIO' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.SEG_PRODUSUA c where c.USUA_IDUSUAR is not null and not exists (select 1 from SYSTEM.SEG_USUARIO p where p.IDUSUAR = c.USUA_IDUSUAR)
union all
select 'SYSTEM' as child_owner, 'SRI_DETALOGF' as child_table, 'ERDO_LGFA_FK' as fk_name, 'SYSTEM' as parent_owner, 'SRI_LOGFACTU' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.SRI_DETALOGF c where c.LGFA_LGFA_ID is not null and not exists (select 1 from SYSTEM.SRI_LOGFACTU p where p.LGFA_ID = c.LGFA_LGFA_ID)
union all
select 'SYSTEM' as child_owner, 'SRI_DETALOGF' as child_table, 'ERDO_TPER_FK' as fk_name, 'SYSTEM' as parent_owner, 'SRI_TPERSSRI' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.SRI_DETALOGF c where c.TPER_CODIERRO is not null and not exists (select 1 from SYSTEM.SRI_TPERSSRI p where p.CODIERRO = c.TPER_CODIERRO)
union all
select 'SYSTEM' as child_owner, 'SRI_LOGFACTU' as child_table, 'LGFA_TPCM_FK' as fk_name, 'SYSTEM' as parent_owner, 'CNT_TIPOCOMP' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.SRI_LOGFACTU c where c.TPCM_TIPOCOMP is not null and not exists (select 1 from SYSTEM.CNT_TIPOCOMP p where p.TIPOCOMP = c.TPCM_TIPOCOMP)
union all
select 'SYSTEM' as child_owner, 'SRV_SEPRVDET' as child_table, 'SPVD_EGEN_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_ESTADOS' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.SRV_SEPRVDET c where c.EGEN_ESTADO is not null and not exists (select 1 from SYSTEM.GEN_ESTADOS p where p.ESTADO = c.EGEN_ESTADO)
union all
select 'SYSTEM' as child_owner, 'SRV_SEPRVDET' as child_table, 'SPVD_RCDP_FK' as fk_name, 'SYSTEM' as parent_owner, 'CLI_RCCLDAPE' as parent_table, 3 as fk_columns, count(*) as orphan_count from SYSTEM.SRV_SEPRVDET c where c.CLTE_COMPANIA is not null and c.CLTE_IDCLIENTE is not null and c.RCDP_IDRESCLI is not null and not exists (select 1 from SYSTEM.CLI_RCCLDAPE p where p.CLTE_COMPANIA = c.CLTE_COMPANIA and p.CLTE_IDCLIENTE = c.CLTE_IDCLIENTE and p.IDRESCLI = c.RCDP_IDRESCLI)
union all
select 'SYSTEM' as child_owner, 'SRV_SEPRVDET' as child_table, 'SPVD_SPVC_FK' as fk_name, 'SYSTEM' as parent_owner, 'SRV_SEPRVCAB' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.SRV_SEPRVDET c where c.SPVC_SPVC_ID is not null and not exists (select 1 from SYSTEM.SRV_SEPRVCAB p where p.SPVC_ID = c.SPVC_SPVC_ID)
union all
select 'SYSTEM' as child_owner, 'SRV_SEPRVDET' as child_table, 'SPVD_SPVD_FK' as fk_name, 'SYSTEM' as parent_owner, 'SRV_SEPRVDET' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.SRV_SEPRVDET c where c.SPVD_SPVD_ID is not null and not exists (select 1 from SYSTEM.SRV_SEPRVDET p where p.SPVD_ID = c.SPVD_SPVD_ID)
union all
select 'SYSTEM' as child_owner, 'SRV_SEPRVDET' as child_table, 'SPVD_STCR_FK' as fk_name, 'SYSTEM' as parent_owner, 'SRV_STCONREC' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.SRV_SEPRVDET c where c.STCR_STCR_ID is not null and not exists (select 1 from SYSTEM.SRV_STCONREC p where p.ID = c.STCR_STCR_ID)
union all
select 'SYSTEM' as child_owner, 'SRV_SEPRVDET' as child_table, 'SPVD_UMED_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_UNIDMEDI' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.SRV_SEPRVDET c where c.UMED_UNIDMEDI is not null and not exists (select 1 from SYSTEM.ALM_UNIDMEDI p where p.UNIDMEDI = c.UMED_UNIDMEDI)
union all
select 'SYSTEM' as child_owner, 'TLL_DETAORDEN' as child_table, 'DTOR_ORTB_FK' as fk_name, 'SYSTEM' as parent_owner, 'TLL_ORDETRAB' as parent_table, 3 as fk_columns, count(*) as orphan_count from SYSTEM.TLL_DETAORDEN c where c.ORTB_ORDEN is not null and c.ORTB_COMPANIA is not null and c.ORTB_OFICINA is not null and not exists (select 1 from SYSTEM.TLL_ORDETRAB p where p.ORDEN = c.ORTB_ORDEN and p.OFCN_COMPANIA = c.ORTB_COMPANIA and p.OFCN_OFICINA = c.ORTB_OFICINA)
union all
select 'SYSTEM' as child_owner, 'TLL_DETAREQUI' as child_table, 'DTRQ_BDGA_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_BODEGAS' as parent_table, 3 as fk_columns, count(*) as orphan_count from SYSTEM.TLL_DETAREQUI c where c.BDGA_CODIBODE is not null and c.BDGA_COMPANIA is not null and c.BDGA_OFICINA is not null and not exists (select 1 from SYSTEM.ALM_BODEGAS p where p.CODIBODE = c.BDGA_CODIBODE and p.OFCN_COMPANIA = c.BDGA_COMPANIA and p.OFCN_OFICINA = c.BDGA_OFICINA)
union all
select 'SYSTEM' as child_owner, 'TLL_DETAREQUI' as child_table, 'DTRQ_ONRC_FK' as fk_name, 'SYSTEM' as parent_owner, 'TLL_ORDENTRC' as parent_table, 4 as fk_columns, count(*) as orphan_count from SYSTEM.TLL_DETAREQUI c where c.ONRC_NUMERO is not null and c.ONRC_COMPANIA is not null and c.ONRC_OFICINA is not null and c.ONRC_ORDEN is not null and not exists (select 1 from SYSTEM.TLL_ORDENTRC p where p.NUMERO = c.ONRC_NUMERO and p.ORTB_COMPANIA = c.ONRC_COMPANIA and p.ORTB_OFICINA = c.ONRC_OFICINA and p.ORTB_ORDEN = c.ONRC_ORDEN)
union all
select 'SYSTEM' as child_owner, 'TLL_ORDENTRC' as child_table, 'ONRC_DTOR_FK' as fk_name, 'SYSTEM' as parent_owner, 'TLL_DETAORDEN' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.TLL_ORDENTRC c where c.DTOR_DTOR_ID is not null and not exists (select 1 from SYSTEM.TLL_DETAORDEN p where p.DTOR_ID = c.DTOR_DTOR_ID)
union all
select 'SYSTEM' as child_owner, 'TLL_ORDENTRC' as child_table, 'ONRC_ENSA_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_ENTRASALI' as parent_table, 4 as fk_columns, count(*) as orphan_count from SYSTEM.TLL_ORDENTRC c where c.ENSA_COMPANIA is not null and c.ENSA_OFICINA is not null and c.ENSA_TIPODOCU is not null and c.ENSA_NUMERO is not null and not exists (select 1 from SYSTEM.ALM_ENTRASALI p where p.OFCN_COMPANIA = c.ENSA_COMPANIA and p.OFCN_OFICINA = c.ENSA_OFICINA and p.TPDC_TIPODOCU = c.ENSA_TIPODOCU and p.NUMERO = c.ENSA_NUMERO)
union all
select 'SYSTEM' as child_owner, 'TLL_ORDENTRC' as child_table, 'ONRC_ORTB_FK' as fk_name, 'SYSTEM' as parent_owner, 'TLL_ORDETRAB' as parent_table, 3 as fk_columns, count(*) as orphan_count from SYSTEM.TLL_ORDENTRC c where c.ORTB_ORDEN is not null and c.ORTB_COMPANIA is not null and c.ORTB_OFICINA is not null and not exists (select 1 from SYSTEM.TLL_ORDETRAB p where p.ORDEN = c.ORTB_ORDEN and p.OFCN_COMPANIA = c.ORTB_COMPANIA and p.OFCN_OFICINA = c.ORTB_OFICINA)
union all
select 'SYSTEM' as child_owner, 'TLL_ORDETRAB' as child_table, 'ORTB_CDT_FK' as fk_name, 'SYSTEM' as parent_owner, 'CLI_CONDUCTR' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.TLL_ORDETRAB c where c.CDT_CDT_ID is not null and not exists (select 1 from SYSTEM.CLI_CONDUCTR p where p.CDT_ID = c.CDT_CDT_ID)
union all
select 'SYSTEM' as child_owner, 'TLL_ORDETRAB' as child_table, 'ORTB_EGEN_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_ESTADOS' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.TLL_ORDETRAB c where c.EGEN_ESTADO is not null and not exists (select 1 from SYSTEM.GEN_ESTADOS p where p.ESTADO = c.EGEN_ESTADO)
union all
select 'SYSTEM' as child_owner, 'TLL_ORDETRAB' as child_table, 'ORTB_ORTB_FK' as fk_name, 'SYSTEM' as parent_owner, 'TLL_ORDETRAB' as parent_table, 3 as fk_columns, count(*) as orphan_count from SYSTEM.TLL_ORDETRAB c where c.ORTB_ORDEN is not null and c.ORTB_COMPANIA is not null and c.ORTB_OFICINA is not null and not exists (select 1 from SYSTEM.TLL_ORDETRAB p where p.ORDEN = c.ORTB_ORDEN and p.OFCN_COMPANIA = c.ORTB_COMPANIA and p.OFCN_OFICINA = c.ORTB_OFICINA)
union all
select 'SYSTEM' as child_owner, 'TLL_ORDETRAB' as child_table, 'ORTB_TPDG_FK' as fk_name, 'SYSTEM' as parent_owner, 'TLL_TIPODIAG' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.TLL_ORDETRAB c where c.TPDG_CODIGO is not null and not exists (select 1 from SYSTEM.TLL_TIPODIAG p where p.CODIGO = c.TPDG_CODIGO)
union all
select 'SYSTEM' as child_owner, 'TLL_ORDETRAB' as child_table, 'ORTB_TPTB_FK' as fk_name, 'SYSTEM' as parent_owner, 'TLL_TPORDTRA' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.TLL_ORDETRAB c where c.TPTB_TP is not null and not exists (select 1 from SYSTEM.TLL_TPORDTRA p where p.TP = c.TPTB_TP)
union all
select 'SYSTEM' as child_owner, 'TLL_ORDETRAB' as child_table, 'ORTB_VHTL_FK' as fk_name, 'SYSTEM' as parent_owner, 'TLL_VEHITALL' as parent_table, 3 as fk_columns, count(*) as orphan_count from SYSTEM.TLL_ORDETRAB c where c.VHTL_PLACA is not null and c.VHTL_COMPANIA is not null and c.VHTL_IDCLIENTE is not null and not exists (select 1 from SYSTEM.TLL_VEHITALL p where p.PLACA = c.VHTL_PLACA and p.CLTE_COMPANIA = c.VHTL_COMPANIA and p.CLTE_IDCLIENTE = c.VHTL_IDCLIENTE)
union all
select 'SYSTEM' as child_owner, 'VEN_DETAFLET' as child_table, 'DTFL_CANT_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_CANTON' as parent_table, 2 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_DETAFLET c where c.CANT_CODICANT is not null and c.CANT_CODIPROV is not null and not exists (select 1 from SYSTEM.GEN_CANTON p where p.CODICANT = c.CANT_CODICANT and p.PVCA_CODIPROV = c.CANT_CODIPROV)
union all
select 'SYSTEM' as child_owner, 'VEN_DETAFLET' as child_table, 'DTFL_SRFL_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_SERVFLET' as parent_table, 3 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_DETAFLET c where c.SRFL_COMPANIA is not null and c.SRFL_OFICINA is not null and c.SRFL_CODIFLET is not null and not exists (select 1 from SYSTEM.GEN_SERVFLET p where p.OFCN_COMPANIA = c.SRFL_COMPANIA and p.OFCN_OFICINA = c.SRFL_OFICINA and p.CODIFLET = c.SRFL_CODIFLET)
union all
select 'SYSTEM' as child_owner, 'VEN_DETAPROD' as child_table, 'DPR_DPR_FK' as fk_name, 'SYSTEM' as parent_owner, 'VEN_DETAPROD' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_DETAPROD c where c.DPR_DPR_ID is not null and not exists (select 1 from SYSTEM.VEN_DETAPROD p where p.DPR_ID = c.DPR_DPR_ID)
union all
select 'SYSTEM' as child_owner, 'VEN_DETAPROD' as child_table, 'DPR_NCCL_FK' as fk_name, 'SYSTEM' as parent_owner, 'VEN_NOTACRED' as parent_table, 4 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_DETAPROD c where c.NCCL_COMPANIA is not null and c.NCCL_OFICINA is not null and c.NCCL_SERIE is not null and c.NCCL_NUMERO is not null and not exists (select 1 from SYSTEM.VEN_NOTACRED p where p.OFCN_COMPANIA = c.NCCL_COMPANIA and p.OFCN_OFICINA = c.NCCL_OFICINA and p.SERIE = c.NCCL_SERIE and p.NUMERO = c.NCCL_NUMERO)
union all
select 'SYSTEM' as child_owner, 'VEN_DETAPROD' as child_table, 'DPR_VNTA_FK' as fk_name, 'SYSTEM' as parent_owner, 'VEN_VENTAS' as parent_table, 5 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_DETAPROD c where c.VNTA_COMPANIA is not null and c.VNTA_OFICINA is not null and c.VNTA_SERIE is not null and c.VNTA_NUMERO is not null and c.VNTA_TIPOCOMP is not null and not exists (select 1 from SYSTEM.VEN_VENTAS p where p.OFCN_COMPANIA = c.VNTA_COMPANIA and p.OFCN_OFICINA = c.VNTA_OFICINA and p.SERIE = c.VNTA_SERIE and p.NUMERO = c.VNTA_NUMERO and p.TPCM_TIPOCOMP = c.VNTA_TIPOCOMP)
union all
select 'SYSTEM' as child_owner, 'VEN_DETAPROF' as child_table, 'DPRF_DPRF_FK' as fk_name, 'SYSTEM' as parent_owner, 'VEN_DETAPROF' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_DETAPROF c where c.DPRF_DPRF_ID is not null and not exists (select 1 from SYSTEM.VEN_DETAPROF p where p.DPRF_ID = c.DPRF_DPRF_ID)
union all
select 'SYSTEM' as child_owner, 'VEN_DETAPROF' as child_table, 'DPRF_PRFM_FK' as fk_name, 'SYSTEM' as parent_owner, 'VEN_PROFORMA' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_DETAPROF c where c.PRFM_PRFM_ID is not null and not exists (select 1 from SYSTEM.VEN_PROFORMA p where p.PRFM_ID = c.PRFM_PRFM_ID)
union all
select 'SYSTEM' as child_owner, 'VEN_DETAPROF' as child_table, 'DPRF_RCTA_FK' as fk_name, 'SYSTEM' as parent_owner, 'CST_RECETA' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_DETAPROF c where c.RCTA_RCTA_ID is not null and not exists (select 1 from SYSTEM.CST_RECETA p where p.RCTA_ID = c.RCTA_RCTA_ID)
union all
select 'SYSTEM' as child_owner, 'VEN_DETAPROF' as child_table, 'DPRF_SECC_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_SECCFISC' as parent_table, 4 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_DETAPROF c where c.SECC_COMPANIA is not null and c.SECC_OFICINA is not null and c.SECC_CODIBODE is not null and c.SECC_CODISECC is not null and not exists (select 1 from SYSTEM.ALM_SECCFISC p where p.BDGA_COMPANIA = c.SECC_COMPANIA and p.BDGA_OFICINA = c.SECC_OFICINA and p.BDGA_CODIBODE = c.SECC_CODIBODE and p.CODISECC = c.SECC_CODISECC)
union all
select 'SYSTEM' as child_owner, 'VEN_DETAPROF' as child_table, 'DPRF_UMED_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_UNIDMEDI' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_DETAPROF c where c.UMED_UNIDMEDI is not null and not exists (select 1 from SYSTEM.ALM_UNIDMEDI p where p.UNIDMEDI = c.UMED_UNIDMEDI)
union all
select 'SYSTEM' as child_owner, 'VEN_DETAPROF' as child_table, 'DPRF_UMED_FK2' as fk_name, 'SYSTEM' as parent_owner, 'ALM_UNIDMEDI' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_DETAPROF c where c.UMED_UNIDMEDI_CAJA is not null and not exists (select 1 from SYSTEM.ALM_UNIDMEDI p where p.UNIDMEDI = c.UMED_UNIDMEDI_CAJA)
union all
select 'SYSTEM' as child_owner, 'VEN_DETARTPR' as child_table, 'DTPR_LNEA_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_LINEAS' as parent_table, 2 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_DETARTPR c where c.LNEA_CODLINEA is not null and c.LNEA_COMPANIA is not null and not exists (select 1 from SYSTEM.ALM_LINEAS p where p.CODLINEA = c.LNEA_CODLINEA and p.CMPN_COMPANIA = c.LNEA_COMPANIA)
union all
select 'SYSTEM' as child_owner, 'VEN_DETARTPR' as child_table, 'DTPR_VEXI_FK' as fk_name, 'SYSTEM' as parent_owner, 'ALM_VRFCEXIS' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_DETARTPR c where c.VEXI_VEXI_ID is not null and not exists (select 1 from SYSTEM.ALM_VRFCEXIS p where p.VEXI_ID = c.VEXI_VEXI_ID)
union all
select 'SYSTEM' as child_owner, 'VEN_GRPOVENT' as child_table, 'GRVN_CDT_FK' as fk_name, 'SYSTEM' as parent_owner, 'CLI_CONDUCTR' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_GRPOVENT c where c.CDT_CDT_ID is not null and not exists (select 1 from SYSTEM.CLI_CONDUCTR p where p.CDT_ID = c.CDT_CDT_ID)
union all
select 'SYSTEM' as child_owner, 'VEN_GRPOVENT' as child_table, 'GRVN_PRFM_FK' as fk_name, 'SYSTEM' as parent_owner, 'VEN_PROFORMA' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_GRPOVENT c where c.PRFM_PRFM_ID is not null and not exists (select 1 from SYSTEM.VEN_PROFORMA p where p.PRFM_ID = c.PRFM_PRFM_ID)
union all
select 'SYSTEM' as child_owner, 'VEN_GRPOVENT' as child_table, 'GRVN_VHCL_FK' as fk_name, 'SYSTEM' as parent_owner, 'CLI_VEHICULO' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_GRPOVENT c where c.VHCL_VHCL_ID is not null and not exists (select 1 from SYSTEM.CLI_VEHICULO p where p.VHCL_ID = c.VHCL_VHCL_ID)
union all
select 'SYSTEM' as child_owner, 'VEN_PLANPAGO' as child_table, 'PLPP_EGEN_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_ESTADOS' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_PLANPAGO c where c.EGEN_ESTADO is not null and not exists (select 1 from SYSTEM.GEN_ESTADOS p where p.ESTADO = c.EGEN_ESTADO)
union all
select 'SYSTEM' as child_owner, 'VEN_PLANPAGO' as child_table, 'PLPP_PRFM_FK' as fk_name, 'SYSTEM' as parent_owner, 'VEN_PROFORMA' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_PLANPAGO c where c.PRFM_PRFM_ID is not null and not exists (select 1 from SYSTEM.VEN_PROFORMA p where p.PRFM_ID = c.PRFM_PRFM_ID)
union all
select 'SYSTEM' as child_owner, 'VEN_TMPRETDETA' as child_table, 'TRDT_TMRT_FK' as fk_name, 'SYSTEM' as parent_owner, 'VEN_TMPRETENC' as parent_table, 3 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_TMPRETDETA c where c.TMRT_CEDURUCCL is not null and c.TMRT_SERIE is not null and c.TMRT_NUMERO is not null and not exists (select 1 from SYSTEM.VEN_TMPRETENC p where p.CEDURUCCL = c.TMRT_CEDURUCCL and p.SERIE = c.TMRT_SERIE and p.NUMERO = c.TMRT_NUMERO)
union all
select 'SYSTEM' as child_owner, 'VEN_TMPRETDETA' as child_table, 'TRDT_TRET_FK' as fk_name, 'SYSTEM' as parent_owner, 'CNT_TIPORETE' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_TMPRETDETA c where c.TRET_TIPORETE is not null and not exists (select 1 from SYSTEM.CNT_TIPORETE p where p.TIPORETE = c.TRET_TIPORETE)
union all
select 'SYSTEM' as child_owner, 'VEN_VENTAS' as child_table, 'VNTA_ASTO_FK' as fk_name, 'SYSTEM' as parent_owner, 'CNT_ASIENTO' as parent_table, 2 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_VENTAS c where c.ASTO_COMPANIA is not null and c.ASTO_NUMEDIAR is not null and not exists (select 1 from SYSTEM.CNT_ASIENTO p where p.CMPN_COMPANIA = c.ASTO_COMPANIA and p.NUMEDIAR = c.ASTO_NUMEDIAR)
union all
select 'SYSTEM' as child_owner, 'VEN_VENTAS' as child_table, 'VNTA_DIDE_FK' as fk_name, 'SYSTEM' as parent_owner, 'CLI_DIASDESC' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_VENTAS c where c.DIDE_DIDE_ID is not null and not exists (select 1 from SYSTEM.CLI_DIASDESC p where p.DIDE_ID = c.DIDE_DIDE_ID)
union all
select 'SYSTEM' as child_owner, 'VEN_VENTAS' as child_table, 'VNTA_EGEN_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_ESTADOS' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_VENTAS c where c.EGEN_ESTADO is not null and not exists (select 1 from SYSTEM.GEN_ESTADOS p where p.ESTADO = c.EGEN_ESTADO)
union all
select 'SYSTEM' as child_owner, 'VEN_VENTAS' as child_table, 'VNTA_FRPG_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_FORMPAGO' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_VENTAS c where c.FRPG_FORMPAGO is not null and not exists (select 1 from SYSTEM.GEN_FORMPAGO p where p.FORMPAGO = c.FRPG_FORMPAGO)
union all
select 'SYSTEM' as child_owner, 'VEN_VENTAS' as child_table, 'VNTA_GRPS_FK' as fk_name, 'SYSTEM' as parent_owner, 'VEN_GRUPOS' as parent_table, 6 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_VENTAS c where c.GRPS_COMPANIA is not null and c.GRPS_IDCLIENTE is not null and c.VNDR_COMPANIA is not null and c.VNDR_OFICINA is not null and c.VNDR_CODIGO is not null and c.GRPS_LSPR_ID is not null and not exists (select 1 from SYSTEM.VEN_GRUPOS p where p.CLTE_COMPANIA = c.GRPS_COMPANIA and p.CLTE_IDCLIENTE = c.GRPS_IDCLIENTE and p.VNDR_COMPANIA = c.VNDR_COMPANIA and p.VNDR_OFICINA = c.VNDR_OFICINA and p.VNDR_CODIGO = c.VNDR_CODIGO and p.LSPR_LSPR_ID = c.GRPS_LSPR_ID)
union all
select 'SYSTEM' as child_owner, 'VEN_VENTAS' as child_table, 'VNTA_INCN_FK' as fk_name, 'SYSTEM' as parent_owner, 'CNT_INTECONT' as parent_table, 4 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_VENTAS c where c.INCN_COMPANIA is not null and c.INCN_PRODUCTO is not null and c.INCN_TIPODOCU is not null and c.INCN_CODITRAN is not null and not exists (select 1 from SYSTEM.CNT_INTECONT p where p.CMPN_COMPANIA = c.INCN_COMPANIA and p.PRDT_PRODUCTO = c.INCN_PRODUCTO and p.TPDC_TIPODOCU = c.INCN_TIPODOCU and p.CODITRAN = c.INCN_CODITRAN)
union all
select 'SYSTEM' as child_owner, 'VEN_VENTAS' as child_table, 'VNTA_LTPR_FK' as fk_name, 'SYSTEM' as parent_owner, 'CST_LOTEPRO' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_VENTAS c where c.LTPR_CODIGO is not null and not exists (select 1 from SYSTEM.CST_LOTEPRO p where p.CODIGO = c.LTPR_CODIGO)
union all
select 'SYSTEM' as child_owner, 'VEN_VENTAS' as child_table, 'VNTA_MONE_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_MONEDA' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_VENTAS c where c.MONE_MONEDA is not null and not exists (select 1 from SYSTEM.GEN_MONEDA p where p.MONEDA = c.MONE_MONEDA)
union all
select 'SYSTEM' as child_owner, 'VEN_VENTAS' as child_table, 'VNTA_ORTB_FK' as fk_name, 'SYSTEM' as parent_owner, 'TLL_ORDETRAB' as parent_table, 3 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_VENTAS c where c.ORTB_ORDEN is not null and c.ORTB_COMPANIA is not null and c.ORTB_OFICINA is not null and not exists (select 1 from SYSTEM.TLL_ORDETRAB p where p.ORDEN = c.ORTB_ORDEN and p.OFCN_COMPANIA = c.ORTB_COMPANIA and p.OFCN_OFICINA = c.ORTB_OFICINA)
union all
select 'SYSTEM' as child_owner, 'VEN_VENTAS' as child_table, 'VNTA_PRFM_FK' as fk_name, 'SYSTEM' as parent_owner, 'VEN_PROFORMA' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_VENTAS c where c.PRFM_PRFM_ID is not null and not exists (select 1 from SYSTEM.VEN_PROFORMA p where p.PRFM_ID = c.PRFM_PRFM_ID)
union all
select 'SYSTEM' as child_owner, 'VEN_VENTAS' as child_table, 'VNTA_PRPG_FK' as fk_name, 'SYSTEM' as parent_owner, 'GEN_PERIPAGO' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_VENTAS c where c.PRPG_CODIPERI is not null and not exists (select 1 from SYSTEM.GEN_PERIPAGO p where p.CODIPERI = c.PRPG_CODIPERI)
union all
select 'SYSTEM' as child_owner, 'VEN_VENTAS' as child_table, 'VNTA_SCTR_FK' as fk_name, 'SYSTEM' as parent_owner, 'CNT_SECUTRAN' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_VENTAS c where c.SCTR_SECUTRAN is not null and not exists (select 1 from SYSTEM.CNT_SECUTRAN p where p.SECUTRAN = c.SCTR_SECUTRAN)
union all
select 'SYSTEM' as child_owner, 'VEN_VENTAS' as child_table, 'VNTA_TPAG_FK' as fk_name, 'SYSTEM' as parent_owner, 'CLI_TPAGRUPA' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_VENTAS c where c.TPAG_CODIGO is not null and not exists (select 1 from SYSTEM.CLI_TPAGRUPA p where p.CODIGO = c.TPAG_CODIGO)
union all
select 'SYSTEM' as child_owner, 'VEN_VENTAS' as child_table, 'VNTA_TPCM_FK' as fk_name, 'SYSTEM' as parent_owner, 'CNT_TIPOCOMP' as parent_table, 1 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_VENTAS c where c.TPCM_TIPOCOMP is not null and not exists (select 1 from SYSTEM.CNT_TIPOCOMP p where p.TIPOCOMP = c.TPCM_TIPOCOMP)
union all
select 'SYSTEM' as child_owner, 'VEN_VENTAS' as child_table, 'VNTA_VNTA_FK' as fk_name, 'SYSTEM' as parent_owner, 'VEN_VENTAS' as parent_table, 5 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_VENTAS c where c.VNTA_COMPANIA is not null and c.VNTA_OFICINA is not null and c.VNTA_SERIE is not null and c.VNTA_NUMERO is not null and c.VNTA_TIPOCOMP is not null and not exists (select 1 from SYSTEM.VEN_VENTAS p where p.OFCN_COMPANIA = c.VNTA_COMPANIA and p.OFCN_OFICINA = c.VNTA_OFICINA and p.SERIE = c.VNTA_SERIE and p.NUMERO = c.VNTA_NUMERO and p.TPCM_TIPOCOMP = c.VNTA_TIPOCOMP)
union all
select 'SYSTEM' as child_owner, 'VEN_VENTPERD' as child_table, 'VNPD_VNTA_FK' as fk_name, 'SYSTEM' as parent_owner, 'VEN_VENTAS' as parent_table, 5 as fk_columns, count(*) as orphan_count from SYSTEM.VEN_VENTPERD c where c.VNTA_COMPANIA is not null and c.VNTA_OFICINA is not null and c.VNTA_SERIE is not null and c.VNTA_NUMERO is not null and c.VNTA_TIPOCOMP is not null and not exists (select 1 from SYSTEM.VEN_VENTAS p where p.OFCN_COMPANIA = c.VNTA_COMPANIA and p.OFCN_OFICINA = c.VNTA_OFICINA and p.SERIE = c.VNTA_SERIE and p.NUMERO = c.VNTA_NUMERO and p.TPCM_TIPOCOMP = c.VNTA_TIPOCOMP)
) order by orphan_count desc, child_table, fk_name
/
exit
