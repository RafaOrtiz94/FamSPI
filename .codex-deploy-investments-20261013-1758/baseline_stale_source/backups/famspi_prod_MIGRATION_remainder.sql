

--
-- Name: project_members_id_seq; Type: SEQUENCE SET; Schema: work_management; Owner: -
--

SELECT pg_catalog.setval('work_management.project_members_id_seq', 4, true);


--
-- Name: spi_links_id_seq; Type: SEQUENCE SET; Schema: work_management; Owner: -
--

SELECT pg_catalog.setval('work_management.spi_links_id_seq', 1, false);


--
-- Name: work_activity_log_id_seq; Type: SEQUENCE SET; Schema: work_management; Owner: -
--

SELECT pg_catalog.setval('work_management.work_activity_log_id_seq', 19, true);


--
-- Name: workspace_members_id_seq; Type: SEQUENCE SET; Schema: work_management; Owner: -
--

SELECT pg_catalog.setval('work_management.workspace_members_id_seq', 4, true);


--
-- Name: logs logs_pkey; Type: CONSTRAINT; Schema: auditoria; Owner: -
--

ALTER TABLE ONLY auditoria.logs
    ADD CONSTRAINT logs_pkey PRIMARY KEY (id);


--
-- Name: crm_accounts crm_accounts_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_accounts
    ADD CONSTRAINT crm_accounts_pkey PRIMARY KEY (id);


--
-- Name: crm_accounts crm_accounts_ruc_key; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_accounts
    ADD CONSTRAINT crm_accounts_ruc_key UNIQUE (ruc);


--
-- Name: crm_action_items crm_action_items_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_action_items
    ADD CONSTRAINT crm_action_items_pkey PRIMARY KEY (id);


--
-- Name: crm_activities crm_activities_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_activities
    ADD CONSTRAINT crm_activities_pkey PRIMARY KEY (id);


--
-- Name: crm_audit_log crm_audit_log_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_audit_log
    ADD CONSTRAINT crm_audit_log_pkey PRIMARY KEY (id);


--
-- Name: crm_blue_sheet_versions crm_blue_sheet_versions_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_blue_sheet_versions
    ADD CONSTRAINT crm_blue_sheet_versions_pkey PRIMARY KEY (id);


--
-- Name: crm_blue_sheets crm_blue_sheets_opportunity_id_key; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_blue_sheets
    ADD CONSTRAINT crm_blue_sheets_opportunity_id_key UNIQUE (opportunity_id);


--
-- Name: crm_blue_sheets crm_blue_sheets_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_blue_sheets
    ADD CONSTRAINT crm_blue_sheets_pkey PRIMARY KEY (id);


--
-- Name: crm_buying_influences crm_buying_influences_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_buying_influences
    ADD CONSTRAINT crm_buying_influences_pkey PRIMARY KEY (id);


--
-- Name: crm_competitive_preferences crm_competitive_preferences_buying_influence_id_competitor__key; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_competitive_preferences
    ADD CONSTRAINT crm_competitive_preferences_buying_influence_id_competitor__key UNIQUE (buying_influence_id, competitor_id);


--
-- Name: crm_competitive_preferences crm_competitive_preferences_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_competitive_preferences
    ADD CONSTRAINT crm_competitive_preferences_pkey PRIMARY KEY (id);


--
-- Name: crm_competitors crm_competitors_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_competitors
    ADD CONSTRAINT crm_competitors_pkey PRIMARY KEY (id);


--
-- Name: crm_contacts crm_contacts_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_contacts
    ADD CONSTRAINT crm_contacts_pkey PRIMARY KEY (id);


--
-- Name: crm_documents crm_documents_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_documents
    ADD CONSTRAINT crm_documents_pkey PRIMARY KEY (id);


--
-- Name: crm_integration_outbox crm_integration_outbox_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_integration_outbox
    ADD CONSTRAINT crm_integration_outbox_pkey PRIMARY KEY (id);


--
-- Name: crm_leads crm_leads_lead_code_key; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_leads
    ADD CONSTRAINT crm_leads_lead_code_key UNIQUE (lead_code);


--
-- Name: crm_leads crm_leads_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_leads
    ADD CONSTRAINT crm_leads_pkey PRIMARY KEY (id);


--
-- Name: crm_lost_reasons crm_lost_reasons_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_lost_reasons
    ADD CONSTRAINT crm_lost_reasons_pkey PRIMARY KEY (id);


--
-- Name: crm_notes crm_notes_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_notes
    ADD CONSTRAINT crm_notes_pkey PRIMARY KEY (id);


--
-- Name: crm_opportunities crm_opportunities_opportunity_code_key; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_opportunities
    ADD CONSTRAINT crm_opportunities_opportunity_code_key UNIQUE (opportunity_code);


--
-- Name: crm_opportunities crm_opportunities_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_opportunities
    ADD CONSTRAINT crm_opportunities_pkey PRIMARY KEY (id);


--
-- Name: crm_opportunity_products crm_opportunity_products_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_opportunity_products
    ADD CONSTRAINT crm_opportunity_products_pkey PRIMARY KEY (id);


--
-- Name: crm_pipeline_stages crm_pipeline_stages_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_pipeline_stages
    ADD CONSTRAINT crm_pipeline_stages_pkey PRIMARY KEY (id);


--
-- Name: crm_red_flags crm_red_flags_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_red_flags
    ADD CONSTRAINT crm_red_flags_pkey PRIMARY KEY (id);


--
-- Name: crm_review_comments crm_review_comments_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_review_comments
    ADD CONSTRAINT crm_review_comments_pkey PRIMARY KEY (id);


--
-- Name: crm_scorecard_answers crm_scorecard_answers_blue_sheet_id_criterion_id_key; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_scorecard_answers
    ADD CONSTRAINT crm_scorecard_answers_blue_sheet_id_criterion_id_key UNIQUE (blue_sheet_id, criterion_id);


--
-- Name: crm_scorecard_answers crm_scorecard_answers_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_scorecard_answers
    ADD CONSTRAINT crm_scorecard_answers_pkey PRIMARY KEY (id);


--
-- Name: crm_scorecard_criteria crm_scorecard_criteria_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_scorecard_criteria
    ADD CONSTRAINT crm_scorecard_criteria_pkey PRIMARY KEY (id);


--
-- Name: crm_strengths crm_strengths_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_strengths
    ADD CONSTRAINT crm_strengths_pkey PRIMARY KEY (id);


--
-- Name: crm_win_results crm_win_results_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_win_results
    ADD CONSTRAINT crm_win_results_pkey PRIMARY KEY (id);


--
-- Name: official_results official_results_pkey; Type: CONSTRAINT; Schema: external_world_cup_2026; Owner: -
--

ALTER TABLE ONLY external_world_cup_2026.official_results
    ADD CONSTRAINT official_results_pkey PRIMARY KEY (id);


--
-- Name: portal_config portal_config_pkey; Type: CONSTRAINT; Schema: external_world_cup_2026; Owner: -
--

ALTER TABLE ONLY external_world_cup_2026.portal_config
    ADD CONSTRAINT portal_config_pkey PRIMARY KEY (id);


--
-- Name: portal_config portal_config_slug_key; Type: CONSTRAINT; Schema: external_world_cup_2026; Owner: -
--

ALTER TABLE ONLY external_world_cup_2026.portal_config
    ADD CONSTRAINT portal_config_slug_key UNIQUE (slug);


--
-- Name: prediction_entries prediction_entries_pkey; Type: CONSTRAINT; Schema: external_world_cup_2026; Owner: -
--

ALTER TABLE ONLY external_world_cup_2026.prediction_entries
    ADD CONSTRAINT prediction_entries_pkey PRIMARY KEY (id);


--
-- Name: prediction_entries prediction_entries_unique_email; Type: CONSTRAINT; Schema: external_world_cup_2026; Owner: -
--

ALTER TABLE ONLY external_world_cup_2026.prediction_entries
    ADD CONSTRAINT prediction_entries_unique_email UNIQUE (email_normalized);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: action_templates action_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_templates
    ADD CONSTRAINT action_templates_pkey PRIMARY KEY (id);


--
-- Name: advisor_location_history advisor_location_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.advisor_location_history
    ADD CONSTRAINT advisor_location_history_pkey PRIMARY KEY (id);


--
-- Name: applicant_documents applicant_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_documents
    ADD CONSTRAINT applicant_documents_pkey PRIMARY KEY (id);


--
-- Name: applicant_education applicant_education_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_education
    ADD CONSTRAINT applicant_education_pkey PRIMARY KEY (id);


--
-- Name: applicant_ethnic_id applicant_ethnic_id_applicant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_ethnic_id
    ADD CONSTRAINT applicant_ethnic_id_applicant_id_key UNIQUE (applicant_id);


--
-- Name: applicant_ethnic_id applicant_ethnic_id_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_ethnic_id
    ADD CONSTRAINT applicant_ethnic_id_pkey PRIMARY KEY (id);


--
-- Name: applicant_health applicant_health_applicant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_health
    ADD CONSTRAINT applicant_health_applicant_id_key UNIQUE (applicant_id);


--
-- Name: applicant_health applicant_health_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_health
    ADD CONSTRAINT applicant_health_pkey PRIMARY KEY (id);


--
-- Name: applicant_licenses applicant_licenses_applicant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_licenses
    ADD CONSTRAINT applicant_licenses_applicant_id_key UNIQUE (applicant_id);


--
-- Name: applicant_licenses applicant_licenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_licenses
    ADD CONSTRAINT applicant_licenses_pkey PRIMARY KEY (id);


--
-- Name: applicant_personal_data applicant_personal_data_applicant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_personal_data
    ADD CONSTRAINT applicant_personal_data_applicant_id_key UNIQUE (applicant_id);


--
-- Name: applicant_personal_data applicant_personal_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_personal_data
    ADD CONSTRAINT applicant_personal_data_pkey PRIMARY KEY (id);


--
-- Name: applicant_personal_references applicant_personal_references_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_personal_references
    ADD CONSTRAINT applicant_personal_references_pkey PRIMARY KEY (id);


--
-- Name: applicant_pipeline_entries applicant_pipeline_entries_applicant_id_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_pipeline_entries
    ADD CONSTRAINT applicant_pipeline_entries_applicant_id_request_id_key UNIQUE (applicant_id, request_id);


--
-- Name: applicant_pipeline_entries applicant_pipeline_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_pipeline_entries
    ADD CONSTRAINT applicant_pipeline_entries_pkey PRIMARY KEY (id);


--
-- Name: applicant_stage_results applicant_stage_results_entry_id_stage_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_stage_results
    ADD CONSTRAINT applicant_stage_results_entry_id_stage_key UNIQUE (entry_id, stage);


--
-- Name: applicant_stage_results applicant_stage_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_stage_results
    ADD CONSTRAINT applicant_stage_results_pkey PRIMARY KEY (id);


--
-- Name: applicant_trainings applicant_trainings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_trainings
    ADD CONSTRAINT applicant_trainings_pkey PRIMARY KEY (id);


--
-- Name: applicant_work_experience applicant_work_experience_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_work_experience
    ADD CONSTRAINT applicant_work_experience_pkey PRIMARY KEY (id);


--
-- Name: applicant_work_references applicant_work_references_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_work_references
    ADD CONSTRAINT applicant_work_references_pkey PRIMARY KEY (id);


--
-- Name: applicants applicants_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicants
    ADD CONSTRAINT applicants_email_key UNIQUE (email);


--
-- Name: applicants applicants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicants
    ADD CONSTRAINT applicants_pkey PRIMARY KEY (id);


--
-- Name: attendance_audit_events attendance_audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_audit_events
    ADD CONSTRAINT attendance_audit_events_pkey PRIMARY KEY (id);


--
-- Name: attendance_birthday_day_off_benefits attendance_birthday_day_off_benefits_cycle_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_birthday_day_off_benefits
    ADD CONSTRAINT attendance_birthday_day_off_benefits_cycle_uniq UNIQUE (user_id, cycle_start);


--
-- Name: attendance_birthday_day_off_benefits attendance_birthday_day_off_benefits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_birthday_day_off_benefits
    ADD CONSTRAINT attendance_birthday_day_off_benefits_pkey PRIMARY KEY (id);


--
-- Name: attendance_birthday_day_off_benefits attendance_birthday_day_off_benefits_token_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_birthday_day_off_benefits
    ADD CONSTRAINT attendance_birthday_day_off_benefits_token_uniq UNIQUE (qr_token);


--
-- Name: attendance_exceptions attendance_exceptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_exceptions
    ADD CONSTRAINT attendance_exceptions_pkey PRIMARY KEY (id);


--
-- Name: attendance_idempotency_keys attendance_idempotency_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_idempotency_keys
    ADD CONSTRAINT attendance_idempotency_keys_pkey PRIMARY KEY (id);


--
-- Name: attendance_late_justifications attendance_late_justifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_late_justifications
    ADD CONSTRAINT attendance_late_justifications_pkey PRIMARY KEY (id);


--
-- Name: attendance_late_justifications attendance_late_justifications_user_id_attendance_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_late_justifications
    ADD CONSTRAINT attendance_late_justifications_user_id_attendance_date_key UNIQUE (user_id, attendance_date);


--
-- Name: attendance_overtime attendance_overtime_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_overtime
    ADD CONSTRAINT attendance_overtime_pkey PRIMARY KEY (id);


--
-- Name: attendance_overtime attendance_overtime_user_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_overtime
    ADD CONSTRAINT attendance_overtime_user_id_date_key UNIQUE (user_id, date);


--
-- Name: attendance_pdf_versions attendance_pdf_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_pdf_versions
    ADD CONSTRAINT attendance_pdf_versions_pkey PRIMARY KEY (id);


--
-- Name: attendance_pending_locations attendance_pending_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_pending_locations
    ADD CONSTRAINT attendance_pending_locations_pkey PRIMARY KEY (id);


--
-- Name: attendance_period_events attendance_period_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_period_events
    ADD CONSTRAINT attendance_period_events_pkey PRIMARY KEY (id);


--
-- Name: attendance_periods attendance_periods_period_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_periods
    ADD CONSTRAINT attendance_periods_period_key_key UNIQUE (period_key);


--
-- Name: attendance_periods attendance_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_periods
    ADD CONSTRAINT attendance_periods_pkey PRIMARY KEY (id);


--
-- Name: attendance_regularization_events attendance_regularization_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_regularization_events
    ADD CONSTRAINT attendance_regularization_events_pkey PRIMARY KEY (id);


--
-- Name: attendance_regularizations attendance_regularizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_regularizations
    ADD CONSTRAINT attendance_regularizations_pkey PRIMARY KEY (id);


--
-- Name: attendance_shortcut_tokens attendance_shortcut_tokens_jti_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_shortcut_tokens
    ADD CONSTRAINT attendance_shortcut_tokens_jti_key UNIQUE (jti);


--
-- Name: attendance_shortcut_tokens attendance_shortcut_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_shortcut_tokens
    ADD CONSTRAINT attendance_shortcut_tokens_pkey PRIMARY KEY (id);


--
-- Name: audit_access_grants audit_access_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_access_grants
    ADD CONSTRAINT audit_access_grants_pkey PRIMARY KEY (id);


--
-- Name: audit_documents audit_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_documents
    ADD CONSTRAINT audit_documents_pkey PRIMARY KEY (id);


--
-- Name: audit_sections audit_sections_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_sections
    ADD CONSTRAINT audit_sections_code_key UNIQUE (code);


--
-- Name: audit_sections audit_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_sections
    ADD CONSTRAINT audit_sections_pkey PRIMARY KEY (id);


--
-- Name: audit_settings audit_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_settings
    ADD CONSTRAINT audit_settings_pkey PRIMARY KEY (id);


--
-- Name: audit_trail audit_trail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_trail
    ADD CONSTRAINT audit_trail_pkey PRIMARY KEY (id);


--
-- Name: bc_alerts bc_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_alerts
    ADD CONSTRAINT bc_alerts_pkey PRIMARY KEY (id);


--
-- Name: bc_audit_log bc_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_audit_log
    ADD CONSTRAINT bc_audit_log_pkey PRIMARY KEY (id);


--
-- Name: bc_calculations bc_calculations_business_case_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_calculations
    ADD CONSTRAINT bc_calculations_business_case_id_key UNIQUE (business_case_id);


--
-- Name: bc_calculations bc_calculations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_calculations
    ADD CONSTRAINT bc_calculations_pkey PRIMARY KEY (id);


--
-- Name: bc_consumption_excluded bc_consumption_excluded_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_consumption_excluded
    ADD CONSTRAINT bc_consumption_excluded_pkey PRIMARY KEY (id);


--
-- Name: bc_consumption_items bc_consumption_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_consumption_items
    ADD CONSTRAINT bc_consumption_items_pkey PRIMARY KEY (id);


--
-- Name: bc_deliveries bc_deliveries_business_case_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_deliveries
    ADD CONSTRAINT bc_deliveries_business_case_id_key UNIQUE (business_case_id);


--
-- Name: bc_deliveries bc_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_deliveries
    ADD CONSTRAINT bc_deliveries_pkey PRIMARY KEY (id);


--
-- Name: bc_determinations bc_determinations_business_case_id_determination_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_determinations
    ADD CONSTRAINT bc_determinations_business_case_id_determination_id_key UNIQUE (business_case_id, determination_id);


--
-- Name: bc_determinations_documents bc_determinations_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_determinations_documents
    ADD CONSTRAINT bc_determinations_documents_pkey PRIMARY KEY (id);


--
-- Name: bc_determinations bc_determinations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_determinations
    ADD CONSTRAINT bc_determinations_pkey PRIMARY KEY (id);


--
-- Name: bc_dispatch_items bc_dispatch_items_business_case_id_item_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_dispatch_items
    ADD CONSTRAINT bc_dispatch_items_business_case_id_item_key_key UNIQUE (business_case_id, item_key);


--
-- Name: bc_dispatch_items bc_dispatch_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_dispatch_items
    ADD CONSTRAINT bc_dispatch_items_pkey PRIMARY KEY (id);


--
-- Name: bc_economic_data bc_economic_data_bc_master_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_economic_data
    ADD CONSTRAINT bc_economic_data_bc_master_id_key UNIQUE (bc_master_id);


--
-- Name: bc_economic_data bc_economic_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_economic_data
    ADD CONSTRAINT bc_economic_data_pkey PRIMARY KEY (id);


--
-- Name: bc_equipment_details bc_equipment_details_business_case_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_equipment_details
    ADD CONSTRAINT bc_equipment_details_business_case_id_key UNIQUE (business_case_id);


--
-- Name: bc_equipment_details bc_equipment_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_equipment_details
    ADD CONSTRAINT bc_equipment_details_pkey PRIMARY KEY (id);


--
-- Name: bc_equipment_selection bc_equipment_selection_business_case_id_equipment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_equipment_selection
    ADD CONSTRAINT bc_equipment_selection_business_case_id_equipment_id_key UNIQUE (business_case_id, equipment_id);


--
-- Name: bc_equipment_selection bc_equipment_selection_business_case_id_is_primary_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_equipment_selection
    ADD CONSTRAINT bc_equipment_selection_business_case_id_is_primary_key UNIQUE (business_case_id, is_primary);


--
-- Name: bc_equipment_selection bc_equipment_selection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_equipment_selection
    ADD CONSTRAINT bc_equipment_selection_pkey PRIMARY KEY (id);


--
-- Name: bc_inventory_reservations bc_inventory_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_inventory_reservations
    ADD CONSTRAINT bc_inventory_reservations_pkey PRIMARY KEY (id);


--
-- Name: bc_inventory_reservations bc_inventory_reservations_unique_bc_equipment; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_inventory_reservations
    ADD CONSTRAINT bc_inventory_reservations_unique_bc_equipment UNIQUE (business_case_id, equipment_id);


--
-- Name: bc_investment_catalog bc_investment_catalog_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_investment_catalog
    ADD CONSTRAINT bc_investment_catalog_code_key UNIQUE (code);


--
-- Name: bc_investment_catalog bc_investment_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_investment_catalog
    ADD CONSTRAINT bc_investment_catalog_pkey PRIMARY KEY (id);


--
-- Name: bc_investment_selection_requests bc_investment_selection_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_investment_selection_requests
    ADD CONSTRAINT bc_investment_selection_requests_pkey PRIMARY KEY (id);


--
-- Name: bc_investment_selections bc_investment_selections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_investment_selections
    ADD CONSTRAINT bc_investment_selections_pkey PRIMARY KEY (id);


--
-- Name: bc_investments bc_investments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_investments
    ADD CONSTRAINT bc_investments_pkey PRIMARY KEY (id);


--
-- Name: bc_lab_environment bc_lab_environment_business_case_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_lab_environment
    ADD CONSTRAINT bc_lab_environment_business_case_id_key UNIQUE (business_case_id);


--
-- Name: bc_lab_environment bc_lab_environment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_lab_environment
    ADD CONSTRAINT bc_lab_environment_pkey PRIMARY KEY (id);


--
-- Name: bc_lis_data bc_lis_data_bc_master_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_lis_data
    ADD CONSTRAINT bc_lis_data_bc_master_id_key UNIQUE (bc_master_id);


--
-- Name: bc_lis_data bc_lis_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_lis_data
    ADD CONSTRAINT bc_lis_data_pkey PRIMARY KEY (id);


--
-- Name: bc_lis_equipment_interfaces bc_lis_equipment_interfaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_lis_equipment_interfaces
    ADD CONSTRAINT bc_lis_equipment_interfaces_pkey PRIMARY KEY (id);


--
-- Name: bc_lis_integration bc_lis_integration_business_case_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_lis_integration
    ADD CONSTRAINT bc_lis_integration_business_case_id_key UNIQUE (business_case_id);


--
-- Name: bc_lis_integration bc_lis_integration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_lis_integration
    ADD CONSTRAINT bc_lis_integration_pkey PRIMARY KEY (id);


--
-- Name: bc_master bc_master_bc_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_master
    ADD CONSTRAINT bc_master_bc_number_key UNIQUE (bc_number);


--
-- Name: bc_master bc_master_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_master
    ADD CONSTRAINT bc_master_pkey PRIMARY KEY (id);


--
-- Name: bc_notification_legal_audit bc_notification_legal_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_notification_legal_audit
    ADD CONSTRAINT bc_notification_legal_audit_pkey PRIMARY KEY (id);


--
-- Name: bc_notification_queue bc_notification_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_notification_queue
    ADD CONSTRAINT bc_notification_queue_pkey PRIMARY KEY (id);


--
-- Name: bc_operational_data bc_operational_data_bc_master_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_operational_data
    ADD CONSTRAINT bc_operational_data_bc_master_id_key UNIQUE (bc_master_id);


--
-- Name: bc_operational_data bc_operational_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_operational_data
    ADD CONSTRAINT bc_operational_data_pkey PRIMARY KEY (id);


--
-- Name: bc_requirements bc_requirements_business_case_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_requirements
    ADD CONSTRAINT bc_requirements_business_case_id_key UNIQUE (business_case_id);


--
-- Name: bc_requirements bc_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_requirements
    ADD CONSTRAINT bc_requirements_pkey PRIMARY KEY (id);


--
-- Name: bc_sheet_generation_jobs bc_sheet_generation_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_sheet_generation_jobs
    ADD CONSTRAINT bc_sheet_generation_jobs_pkey PRIMARY KEY (id);


--
-- Name: bc_sheet_generation_jobs bc_sheet_generation_jobs_unique_idempotency; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_sheet_generation_jobs
    ADD CONSTRAINT bc_sheet_generation_jobs_unique_idempotency UNIQUE (business_case_id, idempotency_key);


--
-- Name: bc_sheet_generation_jobs bc_sheet_generation_jobs_unique_request_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_sheet_generation_jobs
    ADD CONSTRAINT bc_sheet_generation_jobs_unique_request_id UNIQUE (request_id);


--
-- Name: bc_validations bc_validations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_validations
    ADD CONSTRAINT bc_validations_pkey PRIMARY KEY (id);


--
-- Name: bc_workflow_history bc_workflow_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_workflow_history
    ADD CONSTRAINT bc_workflow_history_pkey PRIMARY KEY (id);


--
-- Name: bs_action_item bs_action_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bs_action_item
    ADD CONSTRAINT bs_action_item_pkey PRIMARY KEY (id);


--
-- Name: bs_comment bs_comment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bs_comment
    ADD CONSTRAINT bs_comment_pkey PRIMARY KEY (id);


--
-- Name: business_case_feature_flags business_case_feature_flags_feature_name_section_key_role_k_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_case_feature_flags
    ADD CONSTRAINT business_case_feature_flags_feature_name_section_key_role_k_key UNIQUE (feature_name, section_key, role_key);


--
-- Name: business_case_feature_flags business_case_feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_case_feature_flags
    ADD CONSTRAINT business_case_feature_flags_pkey PRIMARY KEY (id);


--
-- Name: business_case_idempotency_keys business_case_idempotency_key_operation_scope_idempotency_k_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_case_idempotency_keys
    ADD CONSTRAINT business_case_idempotency_key_operation_scope_idempotency_k_key UNIQUE (operation_scope, idempotency_key);


--
-- Name: business_case_idempotency_keys business_case_idempotency_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_case_idempotency_keys
    ADD CONSTRAINT business_case_idempotency_keys_pkey PRIMARY KEY (id);


--
-- Name: business_case_section_ownership business_case_section_ownersh_business_case_id_section_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_case_section_ownership
    ADD CONSTRAINT business_case_section_ownersh_business_case_id_section_name_key UNIQUE (business_case_id, section_name);


--
-- Name: business_case_section_ownership_audit business_case_section_ownership_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_case_section_ownership_audit
    ADD CONSTRAINT business_case_section_ownership_audit_pkey PRIMARY KEY (id);


--
-- Name: business_case_section_ownership business_case_section_ownership_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_case_section_ownership
    ADD CONSTRAINT business_case_section_ownership_pkey PRIMARY KEY (id);


--
-- Name: business_case_state_transitions business_case_state_transitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_case_state_transitions
    ADD CONSTRAINT business_case_state_transitions_pkey PRIMARY KEY (id);


--
-- Name: buying_influence buying_influence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buying_influence
    ADD CONSTRAINT buying_influence_pkey PRIMARY KEY (id);


--
-- Name: ca0101_alarms ca0101_alarms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ca0101_alarms
    ADD CONSTRAINT ca0101_alarms_pkey PRIMARY KEY (id);


--
-- Name: ca0101_devices ca0101_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ca0101_devices
    ADD CONSTRAINT ca0101_devices_pkey PRIMARY KEY (id);


--
-- Name: ca0101_readings ca0101_readings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ca0101_readings
    ADD CONSTRAINT ca0101_readings_pkey PRIMARY KEY (id);


--
-- Name: ca0102_areas ca0102_areas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ca0102_areas
    ADD CONSTRAINT ca0102_areas_pkey PRIMARY KEY (id);


--
-- Name: ca0102_cleaning_logs ca0102_cleaning_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ca0102_cleaning_logs
    ADD CONSTRAINT ca0102_cleaning_logs_pkey PRIMARY KEY (id);


--
-- Name: ca0104_inspections ca0104_inspections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ca0104_inspections
    ADD CONSTRAINT ca0104_inspections_pkey PRIMARY KEY (id);


--
-- Name: ca0104_toxicity ca0104_toxicity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ca0104_toxicity
    ADD CONSTRAINT ca0104_toxicity_pkey PRIMARY KEY (id);


--
-- Name: ca0104_traps_map ca0104_traps_map_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ca0104_traps_map
    ADD CONSTRAINT ca0104_traps_map_pkey PRIMARY KEY (id);


--
-- Name: ca0104_traps_map ca0104_traps_map_trap_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ca0104_traps_map
    ADD CONSTRAINT ca0104_traps_map_trap_code_key UNIQUE (trap_code);


--
-- Name: ca0104_vendor_api ca0104_vendor_api_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ca0104_vendor_api
    ADD CONSTRAINT ca0104_vendor_api_pkey PRIMARY KEY (id);


--
-- Name: calculation_templates calculation_templates_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calculation_templates
    ADD CONSTRAINT calculation_templates_name_key UNIQUE (name);


--
-- Name: calculation_templates calculation_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calculation_templates
    ADD CONSTRAINT calculation_templates_pkey PRIMARY KEY (id);


--
-- Name: catalog_consumables catalog_consumables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_consumables
    ADD CONSTRAINT catalog_consumables_pkey PRIMARY KEY (id);


--
-- Name: catalog_determinations catalog_determinations_name_roche_code_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_determinations
    ADD CONSTRAINT catalog_determinations_name_roche_code_version_key UNIQUE (name, roche_code, version);


--
-- Name: catalog_determinations catalog_determinations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_determinations
    ADD CONSTRAINT catalog_determinations_pkey PRIMARY KEY (id);


--
-- Name: catalog_equipment_consumables catalog_equipment_consumables_equipment_id_consumable_id_de_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_equipment_consumables
    ADD CONSTRAINT catalog_equipment_consumables_equipment_id_consumable_id_de_key UNIQUE (equipment_id, consumable_id, determination_id);


--
-- Name: catalog_equipment_consumables catalog_equipment_consumables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_equipment_consumables
    ADD CONSTRAINT catalog_equipment_consumables_pkey PRIMARY KEY (id);


--
-- Name: catalog_investments catalog_investments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_investments
    ADD CONSTRAINT catalog_investments_pkey PRIMARY KEY (id);


--
-- Name: checklist_config checklist_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_config
    ADD CONSTRAINT checklist_config_pkey PRIMARY KEY (id);


--
-- Name: checklist_config checklist_config_proceso_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_config
    ADD CONSTRAINT checklist_config_proceso_key_key UNIQUE (proceso_key);


--
-- Name: checklist_procesos checklist_procesos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_procesos
    ADD CONSTRAINT checklist_procesos_pkey PRIMARY KEY (id);


--
-- Name: checklist_procesos checklist_procesos_user_id_proceso_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_procesos
    ADD CONSTRAINT checklist_procesos_user_id_proceso_key_key UNIQUE (user_id, proceso_key);


--
-- Name: checklist_steps checklist_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_steps
    ADD CONSTRAINT checklist_steps_pkey PRIMARY KEY (id);


--
-- Name: attendance_exceptions chk_att_ex_arrival_location_required; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.attendance_exceptions
    ADD CONSTRAINT chk_att_ex_arrival_location_required CHECK (((arrival_time IS NULL) OR (COALESCE(NULLIF(btrim(arrival_location), ''::text), ''::text) <> ''::text))) NOT VALID;


--
-- Name: attendance_exceptions chk_att_ex_departure_location_required; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.attendance_exceptions
    ADD CONSTRAINT chk_att_ex_departure_location_required CHECK (((departure_time IS NULL) OR (COALESCE(NULLIF(btrim(departure_location), ''::text), ''::text) <> ''::text))) NOT VALID;


--
-- Name: attendance_exceptions chk_att_ex_return_location_required; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.attendance_exceptions
    ADD CONSTRAINT chk_att_ex_return_location_required CHECK (((return_time IS NULL) OR (COALESCE(NULLIF(btrim(return_location), ''::text), ''::text) <> ''::text))) NOT VALID;


--
-- Name: attendance_exceptions chk_att_ex_start_location_required; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.attendance_exceptions
    ADD CONSTRAINT chk_att_ex_start_location_required CHECK (((start_time IS NULL) OR (COALESCE(NULLIF(btrim(start_location), ''::text), ''::text) <> ''::text))) NOT VALID;


--
-- Name: inventory_movements chk_inventory_movements_type; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.inventory_movements
    ADD CONSTRAINT chk_inventory_movements_type CHECK ((type = ANY (ARRAY['in'::text, 'out'::text]))) NOT VALID;


--
-- Name: request_approvals chk_request_approvals_action; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.request_approvals
    ADD CONSTRAINT chk_request_approvals_action CHECK (((action IS NULL) OR (action = ANY (ARRAY['approve'::text, 'reject'::text])))) NOT VALID;


--
-- Name: user_attendance_records chk_uar_entry_location_required; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.user_attendance_records
    ADD CONSTRAINT chk_uar_entry_location_required CHECK (((entry_time IS NULL) OR (COALESCE(NULLIF(btrim(entry_location), ''::text), ''::text) <> ''::text))) NOT VALID;


--
-- Name: user_attendance_records chk_uar_exit_location_required; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.user_attendance_records
    ADD CONSTRAINT chk_uar_exit_location_required CHECK (((exit_time IS NULL) OR (COALESCE(NULLIF(btrim(exit_location), ''::text), ''::text) <> ''::text))) NOT VALID;


--
-- Name: user_attendance_records chk_uar_lunch_end_location_required; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.user_attendance_records
    ADD CONSTRAINT chk_uar_lunch_end_location_required CHECK (((lunch_end_time IS NULL) OR (COALESCE(NULLIF(btrim(lunch_end_location), ''::text), ''::text) <> ''::text))) NOT VALID;


--
-- Name: user_attendance_records chk_uar_lunch_start_location_required; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.user_attendance_records
    ADD CONSTRAINT chk_uar_lunch_start_location_required CHECK (((lunch_start_time IS NULL) OR (COALESCE(NULLIF(btrim(lunch_start_location), ''::text), ''::text) <> ''::text))) NOT VALID;


--
-- Name: client_assignments client_assignments_client_request_id_assigned_to_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_assignments
    ADD CONSTRAINT client_assignments_client_request_id_assigned_to_email_key UNIQUE (client_request_id, assigned_to_email);


--
-- Name: client_assignments client_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_assignments
    ADD CONSTRAINT client_assignments_pkey PRIMARY KEY (id);


--
-- Name: client_interactions client_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_interactions
    ADD CONSTRAINT client_interactions_pkey PRIMARY KEY (id);


--
-- Name: client_locations client_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_locations
    ADD CONSTRAINT client_locations_pkey PRIMARY KEY (id);


--
-- Name: client_request_consent_tokens client_request_consent_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_request_consent_tokens
    ADD CONSTRAINT client_request_consent_tokens_pkey PRIMARY KEY (id);


--
-- Name: client_request_consents client_request_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_request_consents
    ADD CONSTRAINT client_request_consents_pkey PRIMARY KEY (id);


--
-- Name: client_request_quality_checks client_request_quality_checks_client_request_id_item_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_request_quality_checks
    ADD CONSTRAINT client_request_quality_checks_client_request_id_item_key_key UNIQUE (client_request_id, item_key);


--
-- Name: client_request_quality_checks client_request_quality_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_request_quality_checks
    ADD CONSTRAINT client_request_quality_checks_pkey PRIMARY KEY (id);


--
-- Name: client_requests client_requests_lopdp_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_requests
    ADD CONSTRAINT client_requests_lopdp_token_key UNIQUE (lopdp_token);


--
-- Name: client_requests client_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_requests
    ADD CONSTRAINT client_requests_pkey PRIMARY KEY (id);


--
-- Name: client_requests client_requests_ruc_cedula_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_requests
    ADD CONSTRAINT client_requests_ruc_cedula_key UNIQUE (ruc_cedula);


--
-- Name: client_visit_logs client_visit_logs_client_request_id_user_email_visit_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_visit_logs
    ADD CONSTRAINT client_visit_logs_client_request_id_user_email_visit_date_key UNIQUE (client_request_id, user_email, visit_date);


--
-- Name: client_visit_logs client_visit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_visit_logs
    ADD CONSTRAINT client_visit_logs_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: clients clients_ruc_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_ruc_hash_key UNIQUE (ruc_hash);


--
-- Name: collab_deliveries collab_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_deliveries
    ADD CONSTRAINT collab_deliveries_pkey PRIMARY KEY (id);


--
-- Name: collab_delivery_actas collab_delivery_actas_acta_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_delivery_actas
    ADD CONSTRAINT collab_delivery_actas_acta_code_key UNIQUE (acta_code);


--
-- Name: collab_delivery_actas_items collab_delivery_actas_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_delivery_actas_items
    ADD CONSTRAINT collab_delivery_actas_items_pkey PRIMARY KEY (id);


--
-- Name: collab_delivery_actas collab_delivery_actas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_delivery_actas
    ADD CONSTRAINT collab_delivery_actas_pkey PRIMARY KEY (id);


--
-- Name: collab_delivery_docs collab_delivery_docs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_delivery_docs
    ADD CONSTRAINT collab_delivery_docs_pkey PRIMARY KEY (id);


--
-- Name: collab_delivery_events collab_delivery_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_delivery_events
    ADD CONSTRAINT collab_delivery_events_pkey PRIMARY KEY (id);


--
-- Name: collab_delivery_sessions collab_delivery_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_delivery_sessions
    ADD CONSTRAINT collab_delivery_sessions_pkey PRIMARY KEY (id);


--
-- Name: collab_item_catalog collab_item_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_item_catalog
    ADD CONSTRAINT collab_item_catalog_pkey PRIMARY KEY (id);


--
-- Name: collab_renewal_schedule collab_renewal_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_renewal_schedule
    ADD CONSTRAINT collab_renewal_schedule_pkey PRIMARY KEY (id);


--
-- Name: collaborator_documents collaborator_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaborator_documents
    ADD CONSTRAINT collaborator_documents_pkey PRIMARY KEY (id);


--
-- Name: collaborator_profiles collaborator_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaborator_profiles
    ADD CONSTRAINT collaborator_profiles_pkey PRIMARY KEY (id);


--
-- Name: collaborator_profiles collaborator_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaborator_profiles
    ADD CONSTRAINT collaborator_profiles_user_id_key UNIQUE (user_id);


--
-- Name: collaborator_qualifications collaborator_qualifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaborator_qualifications
    ADD CONSTRAINT collaborator_qualifications_pkey PRIMARY KEY (id);


--
-- Name: competitor_catalog competitor_catalog_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitor_catalog
    ADD CONSTRAINT competitor_catalog_name_key UNIQUE (name);


--
-- Name: competitor_catalog competitor_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitor_catalog
    ADD CONSTRAINT competitor_catalog_pkey PRIMARY KEY (id);


--
-- Name: competitor competitor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitor
    ADD CONSTRAINT competitor_pkey PRIMARY KEY (id);


--
-- Name: consumable_dispatch_lines consumable_dispatch_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_dispatch_lines
    ADD CONSTRAINT consumable_dispatch_lines_pkey PRIMARY KEY (id);


--
-- Name: consumable_file_lines consumable_file_lines_consumable_file_section_id_item_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_file_lines
    ADD CONSTRAINT consumable_file_lines_consumable_file_section_id_item_key_key UNIQUE (consumable_file_section_id, item_key);


--
-- Name: consumable_file_lines consumable_file_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_file_lines
    ADD CONSTRAINT consumable_file_lines_pkey PRIMARY KEY (id);


--
-- Name: consumable_file_sections consumable_file_sections_consumable_file_id_area_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_file_sections
    ADD CONSTRAINT consumable_file_sections_consumable_file_id_area_code_key UNIQUE (consumable_file_id, area_code);


--
-- Name: consumable_file_sections consumable_file_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_file_sections
    ADD CONSTRAINT consumable_file_sections_pkey PRIMARY KEY (id);


--
-- Name: consumable_files consumable_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_files
    ADD CONSTRAINT consumable_files_pkey PRIMARY KEY (id);


--
-- Name: consumable_order_lines consumable_order_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_order_lines
    ADD CONSTRAINT consumable_order_lines_pkey PRIMARY KEY (id);


--
-- Name: consumable_orders consumable_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_orders
    ADD CONSTRAINT consumable_orders_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: contract_determinations contract_determinations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_determinations
    ADD CONSTRAINT contract_determinations_pkey PRIMARY KEY (id);


--
-- Name: delivery_ceiling_audit delivery_ceiling_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_ceiling_audit
    ADD CONSTRAINT delivery_ceiling_audit_pkey PRIMARY KEY (id);


--
-- Name: delivery_ceiling_line delivery_ceiling_line_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_ceiling_line
    ADD CONSTRAINT delivery_ceiling_line_pkey PRIMARY KEY (id);


--
-- Name: delivery_ceiling delivery_ceiling_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_ceiling
    ADD CONSTRAINT delivery_ceiling_pkey PRIMARY KEY (id);


--
-- Name: delivery_dispatch_line delivery_dispatch_line_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_dispatch_line
    ADD CONSTRAINT delivery_dispatch_line_pkey PRIMARY KEY (id);


--
-- Name: delivery_dispatch delivery_dispatch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_dispatch
    ADD CONSTRAINT delivery_dispatch_pkey PRIMARY KEY (id);


--
-- Name: delivery_request_line delivery_request_line_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_request_line
    ADD CONSTRAINT delivery_request_line_pkey PRIMARY KEY (id);


--
-- Name: delivery_request delivery_request_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_request
    ADD CONSTRAINT delivery_request_pkey PRIMARY KEY (id);


--
-- Name: departments departments_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_code_key UNIQUE (code);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: determination_consumption_log determination_consumption_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.determination_consumption_log
    ADD CONSTRAINT determination_consumption_log_pkey PRIMARY KEY (id);


--
-- Name: document_hashes document_hashes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_hashes
    ADD CONSTRAINT document_hashes_pkey PRIMARY KEY (id);


--
-- Name: document_qr_codes document_qr_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_qr_codes
    ADD CONSTRAINT document_qr_codes_pkey PRIMARY KEY (id);


--
-- Name: document_seals document_seals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_seals
    ADD CONSTRAINT document_seals_pkey PRIMARY KEY (id);


--
-- Name: document_seals document_seals_seal_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_seals
    ADD CONSTRAINT document_seals_seal_code_key UNIQUE (seal_code);


--
-- Name: document_signature_logs document_signature_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_signature_logs
    ADD CONSTRAINT document_signature_logs_pkey PRIMARY KEY (id);


--
-- Name: document_signatures_advanced document_signatures_advanced_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_signatures_advanced
    ADD CONSTRAINT document_signatures_advanced_pkey PRIMARY KEY (id);


--
-- Name: document_signatures document_signatures_document_id_signer_user_id_role_at_sign_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_signatures
    ADD CONSTRAINT document_signatures_document_id_signer_user_id_role_at_sign_key UNIQUE (document_id, signer_user_id, role_at_sign);


--
-- Name: document_signatures document_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_signatures
    ADD CONSTRAINT document_signatures_pkey PRIMARY KEY (id);


--
-- Name: document_verifications document_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_verifications
    ADD CONSTRAINT document_verifications_pkey PRIMARY KEY (id);


--
-- Name: document_verifications document_verifications_verification_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_verifications
    ADD CONSTRAINT document_verifications_verification_token_key UNIQUE (verification_token);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: employee_contracts employee_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_contracts
    ADD CONSTRAINT employee_contracts_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: equipment_asset_events equipment_asset_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_asset_events
    ADD CONSTRAINT equipment_asset_events_pkey PRIMARY KEY (id);


--
-- Name: equipment_asset_maintenance_schedule equipment_asset_maintenance_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_asset_maintenance_schedule
    ADD CONSTRAINT equipment_asset_maintenance_schedule_pkey PRIMARY KEY (id);


--
-- Name: equipment_asset_reservations equipment_asset_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_asset_reservations
    ADD CONSTRAINT equipment_asset_reservations_pkey PRIMARY KEY (id);


--
-- Name: equipment_asset_status_catalog equipment_asset_status_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_asset_status_catalog
    ADD CONSTRAINT equipment_asset_status_catalog_pkey PRIMARY KEY (code);


--
-- Name: equipment_assets equipment_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_assets
    ADD CONSTRAINT equipment_assets_pkey PRIMARY KEY (id);


--
-- Name: equipment_maintenance_parts equipment_maintenance_parts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_maintenance_parts
    ADD CONSTRAINT equipment_maintenance_parts_pkey PRIMARY KEY (id);


--
-- Name: equipment_models equipment_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_models
    ADD CONSTRAINT equipment_models_pkey PRIMARY KEY (id);


--
-- Name: equipment_price_history equipment_price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_price_history
    ADD CONSTRAINT equipment_price_history_pkey PRIMARY KEY (id);


--
-- Name: equipment_purchase_business_case_links equipment_purchase_business_case_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_purchase_business_case_links
    ADD CONSTRAINT equipment_purchase_business_case_links_pkey PRIMARY KEY (equipment_purchase_id);


--
-- Name: equipment_purchase_provider_contacts equipment_purchase_provider_contacts_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_purchase_provider_contacts
    ADD CONSTRAINT equipment_purchase_provider_contacts_email_key UNIQUE (email);


--
-- Name: equipment_purchase_provider_contacts equipment_purchase_provider_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_purchase_provider_contacts
    ADD CONSTRAINT equipment_purchase_provider_contacts_pkey PRIMARY KEY (id);


--
-- Name: equipment_purchase_requests equipment_purchase_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_purchase_requests
    ADD CONSTRAINT equipment_purchase_requests_pkey PRIMARY KEY (id);


--
-- Name: equipos_historial equipos_historial_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipos_historial
    ADD CONSTRAINT equipos_historial_pkey PRIMARY KEY (id);


--
-- Name: equipos_modelo equipos_modelo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipos_modelo
    ADD CONSTRAINT equipos_modelo_pkey PRIMARY KEY (id);


--
-- Name: equipos_modelo equipos_modelo_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipos_modelo
    ADD CONSTRAINT equipos_modelo_sku_key UNIQUE (sku);


--
-- Name: equipos_movimientos equipos_movimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipos_movimientos
    ADD CONSTRAINT equipos_movimientos_pkey PRIMARY KEY (id);


--
-- Name: equipos equipos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_pkey PRIMARY KEY (id);


--
-- Name: equipos equipos_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_sku_key UNIQUE (sku);


--
-- Name: equipos_unidad equipos_unidad_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipos_unidad
    ADD CONSTRAINT equipos_unidad_pkey PRIMARY KEY (id);


--
-- Name: equipos_unidad equipos_unidad_serial_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipos_unidad
    ADD CONSTRAINT equipos_unidad_serial_key UNIQUE (serial);


--
-- Name: famdays_configurators famdays_configurators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.famdays_configurators
    ADD CONSTRAINT famdays_configurators_pkey PRIMARY KEY (id);


--
-- Name: famdays_configurators famdays_configurators_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.famdays_configurators
    ADD CONSTRAINT famdays_configurators_user_id_key UNIQUE (user_id);


--
-- Name: famdays_event_qr_tokens famdays_event_qr_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.famdays_event_qr_tokens
    ADD CONSTRAINT famdays_event_qr_tokens_pkey PRIMARY KEY (id);


--
-- Name: famdays_event_qr_tokens famdays_event_qr_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.famdays_event_qr_tokens
    ADD CONSTRAINT famdays_event_qr_tokens_token_key UNIQUE (token);


--
-- Name: hiring_salary_proposals hiring_salary_proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_salary_proposals
    ADD CONSTRAINT hiring_salary_proposals_pkey PRIMARY KEY (id);


--
-- Name: integration_outbox integration_outbox_idempotency_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_outbox
    ADD CONSTRAINT integration_outbox_idempotency_unique UNIQUE (idempotency_key);


--
-- Name: integration_outbox integration_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_outbox
    ADD CONSTRAINT integration_outbox_pkey PRIMARY KEY (id);


--
-- Name: integration_product_map integration_product_map_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_product_map
    ADD CONSTRAINT integration_product_map_pkey PRIMARY KEY (id);


--
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_sku_key UNIQUE (sku);


--
-- Name: kickoff_aporte_ratings kickoff_aporte_ratings_aporte_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_aporte_ratings
    ADD CONSTRAINT kickoff_aporte_ratings_aporte_id_user_id_key UNIQUE (aporte_id, user_id);


--
-- Name: kickoff_aporte_ratings kickoff_aporte_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_aporte_ratings
    ADD CONSTRAINT kickoff_aporte_ratings_pkey PRIMARY KEY (id);


--
-- Name: kickoff_events kickoff_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_events
    ADD CONSTRAINT kickoff_events_pkey PRIMARY KEY (id);


--
-- Name: kickoff_presentation_blocks kickoff_presentation_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_presentation_blocks
    ADD CONSTRAINT kickoff_presentation_blocks_pkey PRIMARY KEY (id);


--
-- Name: kickoff_presentation_ratings kickoff_presentation_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_presentation_ratings
    ADD CONSTRAINT kickoff_presentation_ratings_pkey PRIMARY KEY (id);


--
-- Name: kickoff_presentation_ratings kickoff_presentation_ratings_presentation_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_presentation_ratings
    ADD CONSTRAINT kickoff_presentation_ratings_presentation_id_user_id_key UNIQUE (presentation_id, user_id);


--
-- Name: kickoff_presentations kickoff_presentations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_presentations
    ADD CONSTRAINT kickoff_presentations_pkey PRIMARY KEY (id);


--
-- Name: kickoff_qr_tokens kickoff_qr_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_qr_tokens
    ADD CONSTRAINT kickoff_qr_tokens_pkey PRIMARY KEY (id);


--
-- Name: kickoff_qr_tokens kickoff_qr_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_qr_tokens
    ADD CONSTRAINT kickoff_qr_tokens_token_key UNIQUE (token);


--
-- Name: kickoff_question_ratings kickoff_question_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_question_ratings
    ADD CONSTRAINT kickoff_question_ratings_pkey PRIMARY KEY (id);


--
-- Name: kickoff_question_ratings kickoff_question_ratings_question_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_question_ratings
    ADD CONSTRAINT kickoff_question_ratings_question_id_user_id_key UNIQUE (question_id, user_id);


--
-- Name: kickoff_questions kickoff_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_questions
    ADD CONSTRAINT kickoff_questions_pkey PRIMARY KEY (id);


--
-- Name: kickoff_tiebreaker_candidates kickoff_tiebreaker_candidates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_tiebreaker_candidates
    ADD CONSTRAINT kickoff_tiebreaker_candidates_pkey PRIMARY KEY (id);


--
-- Name: kickoff_tiebreaker_candidates kickoff_tiebreaker_candidates_round_id_aporte_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_tiebreaker_candidates
    ADD CONSTRAINT kickoff_tiebreaker_candidates_round_id_aporte_id_key UNIQUE (round_id, aporte_id);


--
-- Name: kickoff_tiebreaker_rounds kickoff_tiebreaker_rounds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_tiebreaker_rounds
    ADD CONSTRAINT kickoff_tiebreaker_rounds_pkey PRIMARY KEY (id);


--
-- Name: kickoff_tiebreaker_votes kickoff_tiebreaker_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_tiebreaker_votes
    ADD CONSTRAINT kickoff_tiebreaker_votes_pkey PRIMARY KEY (id);


--
-- Name: kickoff_tiebreaker_votes kickoff_tiebreaker_votes_round_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_tiebreaker_votes
    ADD CONSTRAINT kickoff_tiebreaker_votes_round_id_user_id_key UNIQUE (round_id, user_id);


--
-- Name: maintenance_procedure_materials maintenance_procedure_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_procedure_materials
    ADD CONSTRAINT maintenance_procedure_materials_pkey PRIMARY KEY (id);


--
-- Name: maintenance_procedure_parts maintenance_procedure_parts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_procedure_parts
    ADD CONSTRAINT maintenance_procedure_parts_pkey PRIMARY KEY (id);


--
-- Name: maintenance_procedure_parts maintenance_procedure_parts_procedure_id_part_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_procedure_parts
    ADD CONSTRAINT maintenance_procedure_parts_procedure_id_part_id_key UNIQUE (procedure_id, part_id);


--
-- Name: maintenance_procedures maintenance_procedures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_procedures
    ADD CONSTRAINT maintenance_procedures_pkey PRIMARY KEY (id);


--
-- Name: migration_audit_log migration_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_audit_log
    ADD CONSTRAINT migration_audit_log_pkey PRIMARY KEY (id);


--
-- Name: module_global_status module_global_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_global_status
    ADD CONSTRAINT module_global_status_pkey PRIMARY KEY (module_key);


--
-- Name: notification_dispatch_queue notification_dispatch_queue_notification_id_channel_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_dispatch_queue
    ADD CONSTRAINT notification_dispatch_queue_notification_id_channel_key UNIQUE (notification_id, channel);


--
-- Name: notification_dispatch_queue notification_dispatch_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_dispatch_queue
    ADD CONSTRAINT notification_dispatch_queue_pkey PRIMARY KEY (id);


--
-- Name: notification_process_email_threads notification_process_email_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_process_email_threads
    ADD CONSTRAINT notification_process_email_threads_pkey PRIMARY KEY (process_key);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: offboarding_processes offboarding_processes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_processes
    ADD CONSTRAINT offboarding_processes_pkey PRIMARY KEY (user_id);


--
-- Name: offboarding_tasks offboarding_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_tasks
    ADD CONSTRAINT offboarding_tasks_pkey PRIMARY KEY (id);


--
-- Name: offboarding_tasks offboarding_tasks_user_id_task_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_tasks
    ADD CONSTRAINT offboarding_tasks_user_id_task_key_key UNIQUE (user_id, task_key);


--
-- Name: opportunity_flag opportunity_flag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity_flag
    ADD CONSTRAINT opportunity_flag_pkey PRIMARY KEY (id);


--
-- Name: opportunity opportunity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity
    ADD CONSTRAINT opportunity_pkey PRIMARY KEY (id);


--
-- Name: opportunity_process_link opportunity_process_link_opportunity_id_process_type_proces_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity_process_link
    ADD CONSTRAINT opportunity_process_link_opportunity_id_process_type_proces_key UNIQUE (opportunity_id, process_type, process_id);


--
-- Name: opportunity_process_link opportunity_process_link_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity_process_link
    ADD CONSTRAINT opportunity_process_link_pkey PRIMARY KEY (id);


--
-- Name: opportunity_rating opportunity_rating_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity_rating
    ADD CONSTRAINT opportunity_rating_pkey PRIMARY KEY (opportunity_id);


--
-- Name: opportunity_snapshot opportunity_snapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity_snapshot
    ADD CONSTRAINT opportunity_snapshot_pkey PRIMARY KEY (id);


--
-- Name: part_catalog part_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.part_catalog
    ADD CONSTRAINT part_catalog_pkey PRIMARY KEY (id);


--
-- Name: permisos_estudios_matriculas permisos_estudios_matriculas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_estudios_matriculas
    ADD CONSTRAINT permisos_estudios_matriculas_pkey PRIMARY KEY (id);


--
-- Name: permisos_vacaciones_firmas permisos_vacaciones_firmas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_vacaciones_firmas
    ADD CONSTRAINT permisos_vacaciones_firmas_pkey PRIMARY KEY (id);


--
-- Name: permisos_vacaciones permisos_vacaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_vacaciones
    ADD CONSTRAINT permisos_vacaciones_pkey PRIMARY KEY (id);


--
-- Name: personnel_request_comments personnel_request_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_request_comments
    ADD CONSTRAINT personnel_request_comments_pkey PRIMARY KEY (id);


--
-- Name: personnel_request_documents personnel_request_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_request_documents
    ADD CONSTRAINT personnel_request_documents_pkey PRIMARY KEY (id);


--
-- Name: personnel_request_history personnel_request_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_request_history
    ADD CONSTRAINT personnel_request_history_pkey PRIMARY KEY (id);


--
-- Name: personnel_request_profiles personnel_request_profiles_personnel_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_request_profiles
    ADD CONSTRAINT personnel_request_profiles_personnel_request_id_key UNIQUE (personnel_request_id);


--
-- Name: personnel_request_profiles personnel_request_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_request_profiles
    ADD CONSTRAINT personnel_request_profiles_pkey PRIMARY KEY (id);


--
-- Name: personnel_requests personnel_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_requests
    ADD CONSTRAINT personnel_requests_pkey PRIMARY KEY (id);


--
-- Name: personnel_requests personnel_requests_request_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_requests
    ADD CONSTRAINT personnel_requests_request_number_key UNIQUE (request_number);


--
-- Name: private_purchase_requests private_purchase_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.private_purchase_requests
    ADD CONSTRAINT private_purchase_requests_pkey PRIMARY KEY (id);


--
-- Name: private_purchase_state_transitions private_purchase_state_transitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.private_purchase_state_transitions
    ADD CONSTRAINT private_purchase_state_transitions_pkey PRIMARY KEY (id);


--
-- Name: prospect_visits prospect_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_visits
    ADD CONSTRAINT prospect_visits_pkey PRIMARY KEY (id);


--
-- Name: public_delivery_plan_line public_delivery_plan_line_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_delivery_plan_line
    ADD CONSTRAINT public_delivery_plan_line_pkey PRIMARY KEY (id);


--
-- Name: public_delivery_plan public_delivery_plan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_delivery_plan
    ADD CONSTRAINT public_delivery_plan_pkey PRIMARY KEY (id);


--
-- Name: purchase_corrections purchase_corrections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_corrections
    ADD CONSTRAINT purchase_corrections_pkey PRIMARY KEY (id);


--
-- Name: purchase_delivery_schedules purchase_delivery_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_delivery_schedules
    ADD CONSTRAINT purchase_delivery_schedules_pkey PRIMARY KEY (id);


--
-- Name: red_flag_templates red_flag_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.red_flag_templates
    ADD CONSTRAINT red_flag_templates_pkey PRIMARY KEY (id);


--
-- Name: request_approvals request_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_approvals
    ADD CONSTRAINT request_approvals_pkey PRIMARY KEY (id);


--
-- Name: request_approvals request_approvals_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_approvals
    ADD CONSTRAINT request_approvals_token_key UNIQUE (token);


--
-- Name: request_attachments request_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_attachments
    ADD CONSTRAINT request_attachments_pkey PRIMARY KEY (id);


--
-- Name: request_status_history request_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_status_history
    ADD CONSTRAINT request_status_history_pkey PRIMARY KEY (id);


--
-- Name: request_types request_types_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_types
    ADD CONSTRAINT request_types_code_unique UNIQUE (code);


--
-- Name: request_types request_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_types
    ADD CONSTRAINT request_types_pkey PRIMARY KEY (id);


--
-- Name: request_versions request_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_versions
    ADD CONSTRAINT request_versions_pkey PRIMARY KEY (id);


--
-- Name: requests requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_pkey PRIMARY KEY (id);


--
-- Name: scheduled_visits scheduled_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_visits
    ADD CONSTRAINT scheduled_visits_pkey PRIMARY KEY (id);


--
-- Name: scheduled_visits scheduled_visits_schedule_id_client_request_id_planned_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_visits
    ADD CONSTRAINT scheduled_visits_schedule_id_client_request_id_planned_date_key UNIQUE (schedule_id, client_request_id, planned_date);


--
-- Name: signature_workflow_artifacts signature_workflow_artifacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_workflow_artifacts
    ADD CONSTRAINT signature_workflow_artifacts_pkey PRIMARY KEY (id);


--
-- Name: signature_workflow_documents signature_workflow_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_workflow_documents
    ADD CONSTRAINT signature_workflow_documents_pkey PRIMARY KEY (id);


--
-- Name: signature_workflow_documents signature_workflow_documents_workflow_id_version_num_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_workflow_documents
    ADD CONSTRAINT signature_workflow_documents_workflow_id_version_num_key UNIQUE (workflow_id, version_num);


--
-- Name: signature_workflow_events signature_workflow_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_workflow_events
    ADD CONSTRAINT signature_workflow_events_pkey PRIMARY KEY (id);


--
-- Name: signature_workflow_notifications signature_workflow_notifications_dedupe_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_workflow_notifications
    ADD CONSTRAINT signature_workflow_notifications_dedupe_key_key UNIQUE (dedupe_key);


--
-- Name: signature_workflow_notifications signature_workflow_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_workflow_notifications
    ADD CONSTRAINT signature_workflow_notifications_pkey PRIMARY KEY (id);


--
-- Name: signature_workflow_signers signature_workflow_signers_access_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_workflow_signers
    ADD CONSTRAINT signature_workflow_signers_access_token_key UNIQUE (access_token);


--
-- Name: signature_workflow_signers signature_workflow_signers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_workflow_signers
    ADD CONSTRAINT signature_workflow_signers_pkey PRIMARY KEY (id);


--
-- Name: signature_workflows signature_workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_workflows
    ADD CONSTRAINT signature_workflows_pkey PRIMARY KEY (id);


--
-- Name: signature_workflows signature_workflows_verification_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_workflows
    ADD CONSTRAINT signature_workflows_verification_token_key UNIQUE (verification_token);


--
-- Name: signature_workflows signature_workflows_workflow_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_workflows
    ADD CONSTRAINT signature_workflows_workflow_code_key UNIQUE (workflow_code);


--
-- Name: support_ticket_attachments support_ticket_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_attachments
    ADD CONSTRAINT support_ticket_attachments_pkey PRIMARY KEY (id);


--
-- Name: support_ticket_comments support_ticket_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_comments
    ADD CONSTRAINT support_ticket_comments_pkey PRIMARY KEY (id);


--
-- Name: support_ticket_events support_ticket_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_events
    ADD CONSTRAINT support_ticket_events_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_code_key UNIQUE (code);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: system_document_integrity system_document_integrity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_document_integrity
    ADD CONSTRAINT system_document_integrity_pkey PRIMARY KEY (drive_file_id);


--
-- Name: technical_documents technical_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technical_documents
    ADD CONSTRAINT technical_documents_pkey PRIMARY KEY (id);


--
-- Name: ti_asset_accessories ti_asset_accessories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_accessories
    ADD CONSTRAINT ti_asset_accessories_pkey PRIMARY KEY (id);


--
-- Name: ti_asset_actas ti_asset_actas_acta_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_actas
    ADD CONSTRAINT ti_asset_actas_acta_code_key UNIQUE (acta_code);


--
-- Name: ti_asset_actas_items ti_asset_actas_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_actas_items
    ADD CONSTRAINT ti_asset_actas_items_pkey PRIMARY KEY (id);


--
-- Name: ti_asset_actas ti_asset_actas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_actas
    ADD CONSTRAINT ti_asset_actas_pkey PRIMARY KEY (id);


--
-- Name: ti_asset_assignments ti_asset_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_assignments
    ADD CONSTRAINT ti_asset_assignments_pkey PRIMARY KEY (id);


--
-- Name: ti_asset_events ti_asset_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_events
    ADD CONSTRAINT ti_asset_events_pkey PRIMARY KEY (id);


--
-- Name: ti_asset_financial_docs ti_asset_financial_docs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_financial_docs
    ADD CONSTRAINT ti_asset_financial_docs_pkey PRIMARY KEY (id);


--
-- Name: ti_asset_liberation_photos ti_asset_liberation_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_liberation_photos
    ADD CONSTRAINT ti_asset_liberation_photos_pkey PRIMARY KEY (id);


--
-- Name: ti_asset_maintenance_schedule ti_asset_maintenance_schedule_asset_id_planned_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_maintenance_schedule
    ADD CONSTRAINT ti_asset_maintenance_schedule_asset_id_planned_date_key UNIQUE (asset_id, planned_date);


--
-- Name: ti_asset_maintenance_schedule ti_asset_maintenance_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_maintenance_schedule
    ADD CONSTRAINT ti_asset_maintenance_schedule_pkey PRIMARY KEY (id);


--
-- Name: ti_assets ti_assets_asset_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_assets
    ADD CONSTRAINT ti_assets_asset_code_key UNIQUE (asset_code);


--
-- Name: ti_assets ti_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_assets
    ADD CONSTRAINT ti_assets_pkey PRIMARY KEY (id);


--
-- Name: ti_corporate_number_history ti_corporate_number_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_corporate_number_history
    ADD CONSTRAINT ti_corporate_number_history_pkey PRIMARY KEY (id);


--
-- Name: ti_corporate_numbers ti_corporate_numbers_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_corporate_numbers
    ADD CONSTRAINT ti_corporate_numbers_number_key UNIQUE (number);


--
-- Name: ti_corporate_numbers ti_corporate_numbers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_corporate_numbers
    ADD CONSTRAINT ti_corporate_numbers_pkey PRIMARY KEY (id);


--
-- Name: ti_maintenance_reports ti_maintenance_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_maintenance_reports
    ADD CONSTRAINT ti_maintenance_reports_pkey PRIMARY KEY (id);


--
-- Name: training_attendees training_attendees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_attendees
    ADD CONSTRAINT training_attendees_pkey PRIMARY KEY (id);


--
-- Name: training_attendees training_attendees_training_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_attendees
    ADD CONSTRAINT training_attendees_training_id_user_id_key UNIQUE (training_id, user_id);


--
-- Name: trainings trainings_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainings
    ADD CONSTRAINT trainings_code_key UNIQUE (code);


--
-- Name: trainings trainings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainings
    ADD CONSTRAINT trainings_pkey PRIMARY KEY (id);


--
-- Name: travel_allowance_documents travel_allowance_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_documents
    ADD CONSTRAINT travel_allowance_documents_pkey PRIMARY KEY (id);


--
-- Name: travel_allowance_fixed_profiles travel_allowance_fixed_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_fixed_profiles
    ADD CONSTRAINT travel_allowance_fixed_profiles_pkey PRIMARY KEY (id);


--
-- Name: travel_allowance_invoices travel_allowance_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_invoices
    ADD CONSTRAINT travel_allowance_invoices_pkey PRIMARY KEY (id);


--
-- Name: travel_allowance_policy travel_allowance_policy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_policy
    ADD CONSTRAINT travel_allowance_policy_pkey PRIMARY KEY (id);


--
-- Name: travel_allowance_provider_catalog travel_allowance_provider_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_provider_catalog
    ADD CONSTRAINT travel_allowance_provider_catalog_pkey PRIMARY KEY (id);


--
-- Name: travel_allowance_purchases_no_invoice travel_allowance_purchases_no_invoice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_purchases_no_invoice
    ADD CONSTRAINT travel_allowance_purchases_no_invoice_pkey PRIMARY KEY (id);


--
-- Name: travel_allowance_segment_events travel_allowance_segment_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_segment_events
    ADD CONSTRAINT travel_allowance_segment_events_pkey PRIMARY KEY (id);


--
-- Name: travel_allowance_segments travel_allowance_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_segments
    ADD CONSTRAINT travel_allowance_segments_pkey PRIMARY KEY (id);


--
-- Name: travel_allowance_sri_credentials travel_allowance_sri_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_sri_credentials
    ADD CONSTRAINT travel_allowance_sri_credentials_pkey PRIMARY KEY (id);


--
-- Name: travel_allowance_sri_credentials travel_allowance_sri_credentials_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_sri_credentials
    ADD CONSTRAINT travel_allowance_sri_credentials_user_id_key UNIQUE (user_id);


--
-- Name: travel_allowance_zones travel_allowance_zones_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_zones
    ADD CONSTRAINT travel_allowance_zones_code_key UNIQUE (code);


--
-- Name: travel_allowance_zones travel_allowance_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_zones
    ADD CONSTRAINT travel_allowance_zones_pkey PRIMARY KEY (id);


--
-- Name: travel_allowances travel_allowances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowances
    ADD CONSTRAINT travel_allowances_pkey PRIMARY KEY (id);


--
-- Name: travel_segments travel_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_segments
    ADD CONSTRAINT travel_segments_pkey PRIMARY KEY (id);


--
-- Name: clients unique_client_request; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT unique_client_request UNIQUE (client_request_id);


--
-- Name: document_hashes unique_current_hash; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_hashes
    ADD CONSTRAINT unique_current_hash UNIQUE (document_id, is_current) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: user_attendance_records unique_user_date; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_attendance_records
    ADD CONSTRAINT unique_user_date UNIQUE (user_id, date);


--
-- Name: equipment_purchase_requests unique_v2_request_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_purchase_requests
    ADD CONSTRAINT unique_v2_request_id UNIQUE (v2_request_id);


--
-- Name: attendance_pdf_versions uq_attendance_pdf_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_pdf_versions
    ADD CONSTRAINT uq_attendance_pdf_version UNIQUE (user_id, period_type, period_start, period_end, version_number);


--
-- Name: travel_allowance_segments uq_travel_allowance_segments_allowance_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_segments
    ADD CONSTRAINT uq_travel_allowance_segments_allowance_type UNIQUE (allowance_id, segment_type);


--
-- Name: user_attendance_records user_attendance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_attendance_records
    ADD CONSTRAINT user_attendance_records_pkey PRIMARY KEY (id);


--
-- Name: user_certifications user_certifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_certifications
    ADD CONSTRAINT user_certifications_pkey PRIMARY KEY (id);


--
-- Name: user_gmail_tokens user_gmail_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_gmail_tokens
    ADD CONSTRAINT user_gmail_tokens_pkey PRIMARY KEY (id);


--
-- Name: user_gmail_tokens user_gmail_tokens_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_gmail_tokens
    ADD CONSTRAINT user_gmail_tokens_user_id_key UNIQUE (user_id);


--
-- Name: user_lopdp_consents user_lopdp_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_lopdp_consents
    ADD CONSTRAINT user_lopdp_consents_pkey PRIMARY KEY (id);


--
-- Name: user_module_access user_module_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_module_access
    ADD CONSTRAINT user_module_access_pkey PRIMARY KEY (id);


--
-- Name: user_module_access user_module_access_user_id_module_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_module_access
    ADD CONSTRAINT user_module_access_user_id_module_key_key UNIQUE (user_id, module_key);


--
-- Name: user_profile user_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profile
    ADD CONSTRAINT user_profile_pkey PRIMARY KEY (id);


--
-- Name: user_profile user_profile_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profile
    ADD CONSTRAINT user_profile_user_id_key UNIQUE (user_id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_google_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_google_id_key UNIQUE (google_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vacaciones_saldos_historicos vacaciones_saldos_historicos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vacaciones_saldos_historicos
    ADD CONSTRAINT vacaciones_saldos_historicos_pkey PRIMARY KEY (id);


--
-- Name: vacaciones_solicitudes_firmas vacaciones_solicitudes_firmas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vacaciones_solicitudes_firmas
    ADD CONSTRAINT vacaciones_solicitudes_firmas_pkey PRIMARY KEY (id);


--
-- Name: vacaciones_solicitudes vacaciones_solicitudes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vacaciones_solicitudes
    ADD CONSTRAINT vacaciones_solicitudes_pkey PRIMARY KEY (id);


--
-- Name: viatico_anticipos viatico_anticipos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.viatico_anticipos
    ADD CONSTRAINT viatico_anticipos_pkey PRIMARY KEY (id);


--
-- Name: visit_schedules visit_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_schedules
    ADD CONSTRAINT visit_schedules_pkey PRIMARY KEY (id);


--
-- Name: visit_schedules visit_schedules_user_email_month_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_schedules
    ADD CONSTRAINT visit_schedules_user_email_month_year_key UNIQUE (user_email, month, year);


--
-- Name: aplicaciones_tecnicas aplicaciones_tecnicas_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.aplicaciones_tecnicas
    ADD CONSTRAINT aplicaciones_tecnicas_pkey PRIMARY KEY (id);


--
-- Name: corrective_case_comments corrective_case_comments_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.corrective_case_comments
    ADD CONSTRAINT corrective_case_comments_pkey PRIMARY KEY (id);


--
-- Name: corrective_case_events corrective_case_events_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.corrective_case_events
    ADD CONSTRAINT corrective_case_events_pkey PRIMARY KEY (id);


--
-- Name: corrective_case_evidences corrective_case_evidences_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.corrective_case_evidences
    ADD CONSTRAINT corrective_case_evidences_pkey PRIMARY KEY (id);


--
-- Name: corrective_case_spare_parts corrective_case_spare_parts_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.corrective_case_spare_parts
    ADD CONSTRAINT corrective_case_spare_parts_pkey PRIMARY KEY (id);


--
-- Name: corrective_cases corrective_cases_code_key; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.corrective_cases
    ADD CONSTRAINT corrective_cases_code_key UNIQUE (code);


--
-- Name: corrective_cases corrective_cases_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.corrective_cases
    ADD CONSTRAINT corrective_cases_pkey PRIMARY KEY (id);


--
-- Name: cronograma_actividades_tecnicas cronograma_actividades_tecnicas_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.cronograma_actividades_tecnicas
    ADD CONSTRAINT cronograma_actividades_tecnicas_pkey PRIMARY KEY (id);


--
-- Name: cronograma_capacitacion cronograma_capacitacion_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.cronograma_capacitacion
    ADD CONSTRAINT cronograma_capacitacion_pkey PRIMARY KEY (id_capacitacion);


--
-- Name: cronograma_mantenimientos_anuales cronograma_mantenimientos_anuales_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos_anuales
    ADD CONSTRAINT cronograma_mantenimientos_anuales_pkey PRIMARY KEY (id_mant_anual);


--
-- Name: cronograma_mantenimientos cronograma_mantenimientos_id_unique; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos
    ADD CONSTRAINT cronograma_mantenimientos_id_unique UNIQUE (id);


--
-- Name: cronograma_mantenimientos cronograma_mantenimientos_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos
    ADD CONSTRAINT cronograma_mantenimientos_pkey PRIMARY KEY (id_mantenimiento);


--
-- Name: disponibilidad_tecnicos disponibilidad_tecnicos_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.disponibilidad_tecnicos
    ADD CONSTRAINT disponibilidad_tecnicos_pkey PRIMARY KEY (id);


--
-- Name: disponibilidad_tecnicos disponibilidad_tecnicos_user_id_key; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.disponibilidad_tecnicos
    ADD CONSTRAINT disponibilidad_tecnicos_user_id_key UNIQUE (user_id);


--
-- Name: document_template_catalog document_template_catalog_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.document_template_catalog
    ADD CONSTRAINT document_template_catalog_pkey PRIMARY KEY (document_code);


--
-- Name: equipos equipos_nombre_key; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.equipos
    ADD CONSTRAINT equipos_nombre_key UNIQUE (nombre);


--
-- Name: equipos equipos_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.equipos
    ADD CONSTRAINT equipos_pkey PRIMARY KEY (id_equipo);


--
-- Name: external_case_events external_case_events_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.external_case_events
    ADD CONSTRAINT external_case_events_pkey PRIMARY KEY (id);


--
-- Name: external_case_sync_jobs external_case_sync_jobs_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.external_case_sync_jobs
    ADD CONSTRAINT external_case_sync_jobs_pkey PRIMARY KEY (id);


--
-- Name: external_cases external_cases_code_key; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.external_cases
    ADD CONSTRAINT external_cases_code_key UNIQUE (code);


--
-- Name: external_cases external_cases_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.external_cases
    ADD CONSTRAINT external_cases_pkey PRIMARY KEY (id);


--
-- Name: external_provider_identities external_provider_identities_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.external_provider_identities
    ADD CONSTRAINT external_provider_identities_pkey PRIMARY KEY (id);


--
-- Name: preventive_annual_plans preventive_annual_plans_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_annual_plans
    ADD CONSTRAINT preventive_annual_plans_pkey PRIMARY KEY (id);


--
-- Name: preventive_annual_plans preventive_annual_plans_plan_year_version_key; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_annual_plans
    ADD CONSTRAINT preventive_annual_plans_plan_year_version_key UNIQUE (plan_year, version);


--
-- Name: preventive_case_events preventive_case_events_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_case_events
    ADD CONSTRAINT preventive_case_events_pkey PRIMARY KEY (id);


--
-- Name: preventive_documents preventive_documents_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_documents
    ADD CONSTRAINT preventive_documents_pkey PRIMARY KEY (id);


--
-- Name: preventive_execution_reports preventive_execution_reports_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_execution_reports
    ADD CONSTRAINT preventive_execution_reports_pkey PRIMARY KEY (id);


--
-- Name: preventive_kit_requests preventive_kit_requests_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_kit_requests
    ADD CONSTRAINT preventive_kit_requests_pkey PRIMARY KEY (id);


--
-- Name: preventive_offers preventive_offers_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_offers
    ADD CONSTRAINT preventive_offers_pkey PRIMARY KEY (id);


--
-- Name: preventive_plan_items preventive_plan_items_annual_plan_id_equipment_id_planned_m_key; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_plan_items
    ADD CONSTRAINT preventive_plan_items_annual_plan_id_equipment_id_planned_m_key UNIQUE (annual_plan_id, equipment_id, planned_month);


--
-- Name: preventive_plan_items preventive_plan_items_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_plan_items
    ADD CONSTRAINT preventive_plan_items_pkey PRIMARY KEY (id);


--
-- Name: preventive_reprogramming_notices preventive_reprogramming_notices_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_reprogramming_notices
    ADD CONSTRAINT preventive_reprogramming_notices_pkey PRIMARY KEY (id);


--
-- Name: equipos servicio_equipos_code_unique; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.equipos
    ADD CONSTRAINT servicio_equipos_code_unique UNIQUE (code);


--
-- Name: withdrawal_packaging_labels withdrawal_packaging_labels_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.withdrawal_packaging_labels
    ADD CONSTRAINT withdrawal_packaging_labels_pkey PRIMARY KEY (id);


--
-- Name: withdrawal_packaging_labels withdrawal_packaging_labels_workflow_id_package_label_key; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.withdrawal_packaging_labels
    ADD CONSTRAINT withdrawal_packaging_labels_workflow_id_package_label_key UNIQUE (workflow_id, package_label);


--
-- Name: withdrawal_workflows withdrawal_workflows_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.withdrawal_workflows
    ADD CONSTRAINT withdrawal_workflows_pkey PRIMARY KEY (id);


--
-- Name: withdrawal_workflows withdrawal_workflows_source_type_source_id_key; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.withdrawal_workflows
    ADD CONSTRAINT withdrawal_workflows_source_type_source_id_key UNIQUE (source_type, source_id);


--
-- Name: workflow_audit_events workflow_audit_events_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.workflow_audit_events
    ADD CONSTRAINT workflow_audit_events_pkey PRIMARY KEY (id);


--
-- Name: workflow_documents workflow_documents_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.workflow_documents
    ADD CONSTRAINT workflow_documents_pkey PRIMARY KEY (id);


--
-- Name: workflows workflows_pkey; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.workflows
    ADD CONSTRAINT workflows_pkey PRIMARY KEY (id);


--
-- Name: workflows workflows_source_type_source_id_procedure_code_key; Type: CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.workflows
    ADD CONSTRAINT workflows_source_type_source_id_procedure_code_key UNIQUE (source_type, source_id, procedure_code);


--
-- Name: attachments attachments_pkey; Type: CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.attachments
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);


--
-- Name: board_groups board_groups_pkey; Type: CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.board_groups
    ADD CONSTRAINT board_groups_pkey PRIMARY KEY (id);


--
-- Name: boards boards_pkey; Type: CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.boards
    ADD CONSTRAINT boards_pkey PRIMARY KEY (id);


--
-- Name: checklist_items checklist_items_pkey; Type: CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.checklist_items
    ADD CONSTRAINT checklist_items_pkey PRIMARY KEY (id);


--
-- Name: checklists checklists_pkey; Type: CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.checklists
    ADD CONSTRAINT checklists_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: followers followers_item_id_user_id_key; Type: CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.followers
    ADD CONSTRAINT followers_item_id_user_id_key UNIQUE (item_id, user_id);


--
-- Name: followers followers_pkey; Type: CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.followers
    ADD CONSTRAINT followers_pkey PRIMARY KEY (id);


--
-- Name: item_assignees item_assignees_item_id_user_id_key; Type: CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.item_assignees
    ADD CONSTRAINT item_assignees_item_id_user_id_key UNIQUE (item_id, user_id);


--
-- Name: item_assignees item_assignees_pkey; Type: CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.item_assignees
    ADD CONSTRAINT item_assignees_pkey PRIMARY KEY (id);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- Name: project_members project_members_pkey; Type: CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.project_members
    ADD CONSTRAINT project_members_pkey PRIMARY KEY (id);


--
-- Name: project_members project_members_project_id_user_id_key; Type: CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.project_members
    ADD CONSTRAINT project_members_project_id_user_id_key UNIQUE (project_id, user_id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: spi_links spi_links_entity_type_entity_id_source_module_source_entity_key; Type: CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.spi_links
    ADD CONSTRAINT spi_links_entity_type_entity_id_source_module_source_entity_key UNIQUE (entity_type, entity_id, source_module, source_entity_type, source_entity_id, relation_type);


--
-- Name: spi_links spi_links_pkey; Type: CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.spi_links
    ADD CONSTRAINT spi_links_pkey PRIMARY KEY (id);


--
-- Name: work_activity_log work_activity_log_pkey; Type: CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.work_activity_log
    ADD CONSTRAINT work_activity_log_pkey PRIMARY KEY (id);


--
-- Name: workspace_members workspace_members_pkey; Type: CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.workspace_members
    ADD CONSTRAINT workspace_members_pkey PRIMARY KEY (id);


--
-- Name: workspace_members workspace_members_workspace_id_user_id_key; Type: CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_user_id_key UNIQUE (workspace_id, user_id);


--
-- Name: workspaces workspaces_pkey; Type: CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.workspaces
    ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);


--
-- Name: idx_auditoria_accion; Type: INDEX; Schema: auditoria; Owner: -
--

CREATE INDEX idx_auditoria_accion ON auditoria.logs USING btree (accion);


--
-- Name: idx_auditoria_fecha; Type: INDEX; Schema: auditoria; Owner: -
--

CREATE INDEX idx_auditoria_fecha ON auditoria.logs USING btree (fecha DESC);


--
-- Name: idx_auditoria_modulo; Type: INDEX; Schema: auditoria; Owner: -
--

CREATE INDEX idx_auditoria_modulo ON auditoria.logs USING btree (modulo);


--
-- Name: idx_auditoria_usuario; Type: INDEX; Schema: auditoria; Owner: -
--

CREATE INDEX idx_auditoria_usuario ON auditoria.logs USING btree (usuario_email);


--
-- Name: idx_crm_accounts_owner; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_crm_accounts_owner ON crm.crm_accounts USING btree (owner_user_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_crm_accounts_status; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_crm_accounts_status ON crm.crm_accounts USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_crm_audit_log_entity; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_crm_audit_log_entity ON crm.crm_audit_log USING btree (entity_name, entity_id);


--
-- Name: idx_crm_audit_log_user; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_crm_audit_log_user ON crm.crm_audit_log USING btree (performed_by);


--
-- Name: idx_crm_blue_sheets_opportunity; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_crm_blue_sheets_opportunity ON crm.crm_blue_sheets USING btree (opportunity_id);


--
-- Name: idx_crm_blue_sheets_status; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_crm_blue_sheets_status ON crm.crm_blue_sheets USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_crm_contacts_account; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_crm_contacts_account ON crm.crm_contacts USING btree (account_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_crm_integration_outbox_status; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_crm_integration_outbox_status ON crm.crm_integration_outbox USING btree (status) WHERE (processed_at IS NULL);


--
-- Name: idx_crm_leads_city; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_crm_leads_city ON crm.crm_leads USING btree (lower(TRIM(BOTH FROM city)));


--
-- Name: idx_crm_leads_owner; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_crm_leads_owner ON crm.crm_leads USING btree (owner_user_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_crm_leads_status; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_crm_leads_status ON crm.crm_leads USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_crm_opportunities_account; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_crm_opportunities_account ON crm.crm_opportunities USING btree (account_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_crm_opportunities_owner; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_crm_opportunities_owner ON crm.crm_opportunities USING btree (owner_user_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_crm_opportunities_stage; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_crm_opportunities_stage ON crm.crm_opportunities USING btree (stage_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_crm_opportunities_status; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_crm_opportunities_status ON crm.crm_opportunities USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_wc2026_prediction_entries_company; Type: INDEX; Schema: external_world_cup_2026; Owner: -
--

CREATE INDEX idx_wc2026_prediction_entries_company ON external_world_cup_2026.prediction_entries USING btree (company_name);


--
-- Name: idx_wc2026_prediction_entries_created_at; Type: INDEX; Schema: external_world_cup_2026; Owner: -
--

CREATE INDEX idx_wc2026_prediction_entries_created_at ON external_world_cup_2026.prediction_entries USING btree (created_at DESC);


--
-- Name: uq_wc2026_prediction_entries_identity_document; Type: INDEX; Schema: external_world_cup_2026; Owner: -
--

CREATE UNIQUE INDEX uq_wc2026_prediction_entries_identity_document ON external_world_cup_2026.prediction_entries USING btree (identity_document_normalized);


--
-- Name: uq_wc2026_prediction_entries_participant_token; Type: INDEX; Schema: external_world_cup_2026; Owner: -
--

CREATE UNIQUE INDEX uq_wc2026_prediction_entries_participant_token ON external_world_cup_2026.prediction_entries USING btree (participant_token);


--
-- Name: applicant_documents_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX applicant_documents_unique ON public.applicant_documents USING btree (applicant_id, doc_type);


--
-- Name: bc_calculations_business_case_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bc_calculations_business_case_id_idx ON public.bc_calculations USING btree (business_case_id);


--
-- Name: bc_calculations_calculated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bc_calculations_calculated_at_idx ON public.bc_calculations USING btree (calculated_at DESC);


--
-- Name: bc_determinations_business_case_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bc_determinations_business_case_id_idx ON public.bc_determinations USING btree (business_case_id);


--
-- Name: bc_determinations_determination_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bc_determinations_determination_id_idx ON public.bc_determinations USING btree (determination_id);


--
-- Name: bc_determinations_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX bc_determinations_unique_idx ON public.bc_determinations USING btree (business_case_id, determination_id);


--
-- Name: bc_equipment_selection_business_case_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bc_equipment_selection_business_case_id_idx ON public.bc_equipment_selection USING btree (business_case_id);


--
-- Name: bc_equipment_selection_equipment_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bc_equipment_selection_equipment_id_idx ON public.bc_equipment_selection USING btree (equipment_id);


--
-- Name: bc_equipment_selection_primary_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX bc_equipment_selection_primary_unique_idx ON public.bc_equipment_selection USING btree (business_case_id) WHERE (is_primary = true);


--
-- Name: bc_investments_business_case_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bc_investments_business_case_id_idx ON public.bc_investments USING btree (business_case_id);


--
-- Name: bc_investments_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bc_investments_category_idx ON public.bc_investments USING btree (category);


--
-- Name: bc_investments_investment_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bc_investments_investment_type_idx ON public.bc_investments USING btree (investment_type);


--
-- Name: collaborator_documents_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collaborator_documents_user_id_idx ON public.collaborator_documents USING btree (user_id);


--
-- Name: equipment_models_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX equipment_models_code_key ON public.equipment_models USING btree (code) WHERE (code IS NOT NULL);


--
-- Name: idx_accounts_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_client_id ON public.accounts USING btree (client_id);


--
-- Name: idx_accounts_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_name ON public.accounts USING btree (lower((name)::text));


--
-- Name: idx_ae_correlation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ae_correlation_id ON public.attendance_exceptions USING btree (correlation_id);


--
-- Name: idx_ae_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ae_request_id ON public.attendance_exceptions USING btree (request_id);


--
-- Name: idx_applicants_personnel_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applicants_personnel_request_id ON public.applicants USING btree (personnel_request_id);


--
-- Name: idx_att_pending_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_att_pending_request_id ON public.attendance_pending_locations USING btree (request_id);


--
-- Name: idx_att_pending_status_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_att_pending_status_expires ON public.attendance_pending_locations USING btree (status, expires_at);


--
-- Name: idx_attendance_audit_events_action_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_audit_events_action_time ON public.attendance_audit_events USING btree (action, created_at DESC);


--
-- Name: idx_attendance_audit_events_actor_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_audit_events_actor_time ON public.attendance_audit_events USING btree (actor_user_id, created_at DESC);


--
-- Name: idx_attendance_audit_events_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_audit_events_request ON public.attendance_audit_events USING btree (request_id, correlation_id);


--
-- Name: idx_attendance_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_date ON public.user_attendance_records USING btree (date DESC);


--
-- Name: idx_attendance_exceptions_active_by_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_exceptions_active_by_user ON public.attendance_exceptions USING btree (user_id, id DESC) WHERE (upper((COALESCE(status, ''::character varying))::text) <> 'COMPLETED'::text);


--
-- Name: idx_attendance_exceptions_operational_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_exceptions_operational_category ON public.attendance_exceptions USING btree (operational_category) WHERE (operational_category IS NOT NULL);


--
-- Name: idx_attendance_exceptions_personal_vehicle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_exceptions_personal_vehicle ON public.attendance_exceptions USING btree (uses_personal_vehicle) WHERE (uses_personal_vehicle = true);


--
-- Name: idx_attendance_exceptions_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_exceptions_user_date ON public.attendance_exceptions USING btree (user_id, date);


--
-- Name: idx_attendance_exceptions_user_date_report; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_exceptions_user_date_report ON public.attendance_exceptions USING btree (user_id, date);


--
-- Name: idx_attendance_idempotency_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_idempotency_expiry ON public.attendance_idempotency_keys USING btree (expires_at);


--
-- Name: idx_attendance_incomplete; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_incomplete ON public.user_attendance_records USING btree (user_id, date) WHERE (exit_time IS NULL);


--
-- Name: idx_attendance_overtime_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_overtime_date ON public.attendance_overtime USING btree (date);


--
-- Name: idx_attendance_overtime_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_overtime_user_date ON public.attendance_overtime USING btree (user_id, date);


--
-- Name: idx_attendance_pdf_versions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_pdf_versions_status ON public.attendance_pdf_versions USING btree (status, generated_at DESC);


--
-- Name: idx_attendance_pdf_versions_user_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_pdf_versions_user_period ON public.attendance_pdf_versions USING btree (user_id, period_type, period_start, period_end);


--
-- Name: idx_attendance_pending_locations_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_pending_locations_user_status ON public.attendance_pending_locations USING btree (user_id, status, created_at DESC);


--
-- Name: idx_attendance_period_events_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_period_events_period ON public.attendance_period_events USING btree (period_id, created_at DESC);


--
-- Name: idx_attendance_periods_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_periods_status ON public.attendance_periods USING btree (status);


--
-- Name: idx_attendance_periods_year_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_periods_year_month ON public.attendance_periods USING btree (period_year, period_month);


--
-- Name: idx_attendance_regularization_events_reg; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_regularization_events_reg ON public.attendance_regularization_events USING btree (regularization_id, created_at DESC);


--
-- Name: idx_attendance_regularizations_affected_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_regularizations_affected_date ON public.attendance_regularizations USING btree (affected_user_id, attendance_date);


--
-- Name: idx_attendance_regularizations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_regularizations_status ON public.attendance_regularizations USING btree (status, created_at DESC);


--
-- Name: idx_attendance_shortcut_tokens_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_shortcut_tokens_user ON public.attendance_shortcut_tokens USING btree (user_id);


--
-- Name: idx_attendance_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_user_date ON public.user_attendance_records USING btree (user_id, date DESC);


--
-- Name: idx_audit_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_created_at ON public.audit_trail USING btree (created_at DESC);


--
-- Name: idx_audit_documents_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_documents_section ON public.audit_documents USING btree (section_code);


--
-- Name: idx_audit_documents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_documents_status ON public.audit_documents USING btree (status);


--
-- Name: idx_audit_module_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_module_action ON public.audit_trail USING btree (module, action);


--
-- Name: idx_audit_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_user ON public.audit_trail USING btree (user_id);


--
-- Name: idx_bc_alerts_acknowledged; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_alerts_acknowledged ON public.bc_alerts USING btree (acknowledged);


--
-- Name: idx_bc_alerts_bc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_alerts_bc ON public.bc_alerts USING btree (business_case_id);


--
-- Name: idx_bc_alerts_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_alerts_contract ON public.bc_alerts USING btree (contract_determination_id);


--
-- Name: idx_bc_alerts_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_alerts_severity ON public.bc_alerts USING btree (severity);


--
-- Name: idx_bc_alerts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_alerts_type ON public.bc_alerts USING btree (alert_type);


--
-- Name: idx_bc_audit_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_audit_action ON public.bc_audit_log USING btree (action);


--
-- Name: idx_bc_audit_bc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_audit_bc ON public.bc_audit_log USING btree (business_case_id);


--
-- Name: idx_bc_audit_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_audit_date ON public.bc_audit_log USING btree (changed_at);


--
-- Name: idx_bc_calculations_bc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_calculations_bc ON public.bc_calculations USING btree (business_case_id);


--
-- Name: idx_bc_calculations_win_probability; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_calculations_win_probability ON public.bc_calculations USING btree (win_probability DESC NULLS LAST);


--
-- Name: idx_bc_consumption_excluded_bc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_consumption_excluded_bc ON public.bc_consumption_excluded USING btree (business_case_id);


--
-- Name: idx_bc_consumption_items_bc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_consumption_items_bc ON public.bc_consumption_items USING btree (business_case_id);


--
-- Name: idx_bc_consumption_items_bc_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_consumption_items_bc_type ON public.bc_consumption_items USING btree (business_case_id, item_type);


--
-- Name: idx_bc_deliveries_bc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_deliveries_bc_id ON public.bc_deliveries USING btree (business_case_id);


--
-- Name: idx_bc_det_docs_case_uploaded; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_det_docs_case_uploaded ON public.bc_determinations_documents USING btree (business_case_id, uploaded_at DESC, id DESC);


--
-- Name: idx_bc_det_docs_current; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_det_docs_current ON public.bc_determinations_documents USING btree (business_case_id, is_current);


--
-- Name: idx_bc_det_docs_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_det_docs_hash ON public.bc_determinations_documents USING btree (document_hash_sha256);


--
-- Name: idx_bc_determinations_bc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_determinations_bc ON public.bc_determinations USING btree (business_case_id);


--
-- Name: idx_bc_determinations_det; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_determinations_det ON public.bc_determinations USING btree (determination_id);


--
-- Name: idx_bc_determinations_master; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_determinations_master ON public.bc_determinations USING btree (bc_master_id);


--
-- Name: idx_bc_dispatch_items_bc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_dispatch_items_bc ON public.bc_dispatch_items USING btree (business_case_id);


--
-- Name: idx_bc_dispatch_items_equipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_dispatch_items_equipment ON public.bc_dispatch_items USING btree (business_case_id, equipment_id, item_type);


--
-- Name: idx_bc_dispatch_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_dispatch_items_status ON public.bc_dispatch_items USING btree (business_case_id, ops_status);


--
-- Name: idx_bc_economic_data_master; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_economic_data_master ON public.bc_economic_data USING btree (bc_master_id);


--
-- Name: idx_bc_equipment_details_bc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_equipment_details_bc_id ON public.bc_equipment_details USING btree (business_case_id);


--
-- Name: idx_bc_feature_flags_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_feature_flags_lookup ON public.business_case_feature_flags USING btree (feature_name, section_key, role_key, is_enabled);


--
-- Name: idx_bc_idempotency_business_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_idempotency_business_case ON public.business_case_idempotency_keys USING btree (business_case_id, created_at DESC);


--
-- Name: idx_bc_idempotency_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_idempotency_status ON public.business_case_idempotency_keys USING btree (status, updated_at DESC);


--
-- Name: idx_bc_inv_sel_req_bc_catalog; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_inv_sel_req_bc_catalog ON public.bc_investment_selection_requests USING btree (business_case_id, catalog_id);


--
-- Name: idx_bc_inv_sel_req_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_inv_sel_req_pending ON public.bc_investment_selection_requests USING btree (business_case_id, status) WHERE (status = 'pending'::text);


--
-- Name: idx_bc_inventory_reservations_bc_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_inventory_reservations_bc_status ON public.bc_inventory_reservations USING btree (business_case_id, status);


--
-- Name: idx_bc_inventory_reservations_equipment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_inventory_reservations_equipment_status ON public.bc_inventory_reservations USING btree (equipment_id, status);


--
-- Name: idx_bc_investment_catalog_class; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_investment_catalog_class ON public.bc_investment_catalog USING btree (investment_class);


--
-- Name: idx_bc_investment_selections_bc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_investment_selections_bc ON public.bc_investment_selections USING btree (business_case_id);


--
-- Name: idx_bc_investment_selections_catalog; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_investment_selections_catalog ON public.bc_investment_selections USING btree (catalog_id);


--
-- Name: idx_bc_investments_bc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_investments_bc ON public.bc_investments USING btree (business_case_id);


--
-- Name: idx_bc_investments_master; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_investments_master ON public.bc_investments USING btree (bc_master_id);


--
-- Name: idx_bc_lab_environment_bc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_lab_environment_bc_id ON public.bc_lab_environment USING btree (business_case_id);


--
-- Name: idx_bc_lis_data_master; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_lis_data_master ON public.bc_lis_data USING btree (bc_master_id);


--
-- Name: idx_bc_lis_equipment_interfaces_lis_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_lis_equipment_interfaces_lis_id ON public.bc_lis_equipment_interfaces USING btree (bc_lis_data_id);


--
-- Name: idx_bc_lis_equipment_interfaces_lis_integration_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_lis_equipment_interfaces_lis_integration_id ON public.bc_lis_equipment_interfaces USING btree (lis_integration_id);


--
-- Name: idx_bc_lis_integration_bc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_lis_integration_bc_id ON public.bc_lis_integration USING btree (business_case_id);


--
-- Name: idx_bc_lis_interfaces_lis; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_lis_interfaces_lis ON public.bc_lis_equipment_interfaces USING btree (bc_lis_data_id);


--
-- Name: idx_bc_master_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_master_client ON public.bc_master USING btree (client_id);


--
-- Name: idx_bc_master_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_master_created ON public.bc_master USING btree (created_at DESC);


--
-- Name: idx_bc_master_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_master_stage ON public.bc_master USING btree (current_stage);


--
-- Name: idx_bc_master_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_master_type ON public.bc_master USING btree (bc_type);


--
-- Name: idx_bc_notification_legal_audit_business_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_notification_legal_audit_business_case ON public.bc_notification_legal_audit USING btree (business_case_id, created_at DESC);


--
-- Name: idx_bc_notification_legal_audit_process_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_notification_legal_audit_process_code ON public.bc_notification_legal_audit USING btree (process_code, created_at DESC);


--
-- Name: idx_bc_notification_queue_business_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_notification_queue_business_case ON public.bc_notification_queue USING btree (business_case_id, created_at DESC);


--
-- Name: idx_bc_notification_queue_status_next_attempt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_notification_queue_status_next_attempt ON public.bc_notification_queue USING btree (status, next_attempt_at, priority DESC, id);


--
-- Name: idx_bc_operational_data_master; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_operational_data_master ON public.bc_operational_data USING btree (bc_master_id);


--
-- Name: idx_bc_requirements_bc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_requirements_bc_id ON public.bc_requirements USING btree (business_case_id);


--
-- Name: idx_bc_section_ownership_audit_bc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_section_ownership_audit_bc_id ON public.business_case_section_ownership_audit USING btree (business_case_id);


--
-- Name: idx_bc_section_ownership_audit_performed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_section_ownership_audit_performed_at ON public.business_case_section_ownership_audit USING btree (performed_at);


--
-- Name: idx_bc_section_ownership_audit_performed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_section_ownership_audit_performed_by ON public.business_case_section_ownership_audit USING btree (performed_by);


--
-- Name: idx_bc_section_ownership_audit_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_section_ownership_audit_section ON public.business_case_section_ownership_audit USING btree (section_name);


--
-- Name: idx_bc_section_ownership_bc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_section_ownership_bc_id ON public.business_case_section_ownership USING btree (business_case_id);


--
-- Name: idx_bc_section_ownership_completed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_section_ownership_completed_by ON public.business_case_section_ownership USING btree (completed_by);


--
-- Name: idx_bc_section_ownership_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_section_ownership_section ON public.business_case_section_ownership USING btree (section_name);


--
-- Name: idx_bc_sheet_jobs_business_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_sheet_jobs_business_case ON public.bc_sheet_generation_jobs USING btree (business_case_id, created_at DESC);


--
-- Name: idx_bc_sheet_jobs_correlation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_sheet_jobs_correlation ON public.bc_sheet_generation_jobs USING btree (correlation_id);


--
-- Name: idx_bc_sheet_jobs_status_retry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_sheet_jobs_status_retry ON public.bc_sheet_generation_jobs USING btree (status, next_retry_at, id);


--
-- Name: idx_bc_validations_master; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_validations_master ON public.bc_validations USING btree (bc_master_id, severity);


--
-- Name: idx_bc_workflow_history_master; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_workflow_history_master ON public.bc_workflow_history USING btree (bc_master_id, changed_at DESC);


--
-- Name: idx_bs_action_item_assignee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bs_action_item_assignee ON public.bs_action_item USING btree (assignee_user_id);


--
-- Name: idx_bs_action_item_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bs_action_item_due_date ON public.bs_action_item USING btree (due_date);


--
-- Name: idx_bs_action_item_opportunity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bs_action_item_opportunity_id ON public.bs_action_item USING btree (opportunity_id);


--
-- Name: idx_bs_comment_opportunity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bs_comment_opportunity_id ON public.bs_comment USING btree (opportunity_id, created_at DESC);


--
-- Name: idx_buying_influence_opportunity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buying_influence_opportunity_id ON public.buying_influence USING btree (opportunity_id);


--
-- Name: idx_buying_influence_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buying_influence_role ON public.buying_influence USING btree (role);


--
-- Name: idx_ca0101_alarms_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ca0101_alarms_status ON public.ca0101_alarms USING btree (status);


--
-- Name: idx_ca0101_devices_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ca0101_devices_location ON public.ca0101_devices USING btree (location);


--
-- Name: idx_ca0101_readings_device_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ca0101_readings_device_date ON public.ca0101_readings USING btree (device_id, recorded_at DESC);


--
-- Name: idx_ca0102_logs_area; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ca0102_logs_area ON public.ca0102_cleaning_logs USING btree (area_id);


--
-- Name: idx_ca0102_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ca0102_logs_status ON public.ca0102_cleaning_logs USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_ca0104_inspections_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ca0104_inspections_status ON public.ca0104_inspections USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_ca0104_inspections_traps_map_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ca0104_inspections_traps_map_id ON public.ca0104_inspections USING btree (traps_map_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_ca0104_toxicity_inspection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ca0104_toxicity_inspection_id ON public.ca0104_toxicity USING btree (inspection_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_ca0104_toxicity_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ca0104_toxicity_status ON public.ca0104_toxicity USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_ca0104_traps_map_risk_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ca0104_traps_map_risk_level ON public.ca0104_traps_map USING btree (risk_level) WHERE (deleted_at IS NULL);


--
-- Name: idx_ca0104_traps_map_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ca0104_traps_map_status ON public.ca0104_traps_map USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_ca0104_vendor_api_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ca0104_vendor_api_status ON public.ca0104_vendor_api USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_calc_templates_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calc_templates_active ON public.calculation_templates USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_calc_templates_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calc_templates_category ON public.calculation_templates USING btree (category);


--
-- Name: idx_catalog_consumables_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_consumables_name ON public.catalog_consumables USING btree (name);


--
-- Name: idx_catalog_consumables_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_consumables_status ON public.catalog_consumables USING btree (status);


--
-- Name: idx_catalog_consumables_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_consumables_type ON public.catalog_consumables USING btree (type);


--
-- Name: idx_catalog_determinations_equipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_determinations_equipment ON public.catalog_determinations USING btree (equipment_id);


--
-- Name: idx_catalog_determinations_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_determinations_name ON public.catalog_determinations USING btree (name);


--
-- Name: idx_catalog_determinations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_determinations_status ON public.catalog_determinations USING btree (status);


--
-- Name: idx_catalog_inv_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_inv_category ON public.catalog_investments USING btree (category);


--
-- Name: idx_catalog_inv_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_inv_status ON public.catalog_investments USING btree (status);


--
-- Name: idx_client_assignments_assigned_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_assignments_assigned_email ON public.client_assignments USING btree (assigned_to_email);


--
-- Name: idx_client_assignments_client_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_assignments_client_active ON public.client_assignments USING btree (client_request_id, is_active, starts_at, ends_at);


--
-- Name: idx_client_interactions_client_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_interactions_client_created_at ON public.client_interactions USING btree (client_id, created_at DESC);


--
-- Name: idx_client_interactions_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_interactions_created_by ON public.client_interactions USING btree (created_by);


--
-- Name: idx_client_locations_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_locations_client_id ON public.client_locations USING btree (client_id);


--
-- Name: idx_client_locations_geo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_locations_geo ON public.client_locations USING btree (lat, lng);


--
-- Name: idx_client_requests_approval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_requests_approval_status ON public.client_requests USING btree (approval_status);


--
-- Name: idx_client_requests_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_requests_created_by ON public.client_requests USING btree (created_by);


--
-- Name: idx_client_requests_external_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_requests_external_source ON public.client_requests USING btree (external_source);


--
-- Name: idx_client_requests_opportunity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_requests_opportunity ON public.client_requests USING btree (opportunity_id);


--
-- Name: idx_client_requests_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_requests_user_id ON public.client_requests USING btree (user_id);


--
-- Name: idx_client_visit_logs_user_date_report; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_visit_logs_user_date_report ON public.client_visit_logs USING btree (user_email, visit_date);


--
-- Name: idx_client_visit_logs_user_lower_date_report; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_visit_logs_user_lower_date_report ON public.client_visit_logs USING btree (lower(COALESCE(user_email, ''::text)), visit_date);


--
-- Name: idx_clients_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_created_at ON public.clients USING btree (created_at DESC);


--
-- Name: idx_clients_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_estado ON public.clients USING btree (estado);


--
-- Name: idx_clients_ruc_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_ruc_hash ON public.clients USING btree (ruc_hash);


--
-- Name: idx_collab_actas_delivery; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collab_actas_delivery ON public.collab_delivery_actas USING btree (delivery_id);


--
-- Name: idx_collab_actas_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collab_actas_generated ON public.collab_delivery_actas USING btree (generated_at DESC);


--
-- Name: idx_collab_actas_items_acta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collab_actas_items_acta ON public.collab_delivery_actas_items USING btree (acta_id);


--
-- Name: idx_collab_actas_pending_signature; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collab_actas_pending_signature ON public.collab_delivery_actas USING btree (generated_at) WHERE ((is_complete = false) AND (active = true));


--
-- Name: idx_collab_actas_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collab_actas_session ON public.collab_delivery_actas USING btree (session_id);


--
-- Name: idx_collab_actas_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collab_actas_user ON public.collab_delivery_actas USING btree (recipient_user_id);


--
-- Name: idx_collab_catalog_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collab_catalog_category ON public.collab_item_catalog USING btree (category) WHERE (active = true);


--
-- Name: idx_collab_deliveries_catalog; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collab_deliveries_catalog ON public.collab_deliveries USING btree (catalog_item_id);


--
-- Name: idx_collab_deliveries_renewal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collab_deliveries_renewal ON public.collab_deliveries USING btree (renewal_date) WHERE ((renewal_date IS NOT NULL) AND (status = 'entregado'::text));


--
-- Name: idx_collab_deliveries_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collab_deliveries_session ON public.collab_deliveries USING btree (session_id);


--
-- Name: idx_collab_deliveries_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collab_deliveries_status ON public.collab_deliveries USING btree (status) WHERE (active = true);


--
-- Name: idx_collab_deliveries_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collab_deliveries_user ON public.collab_deliveries USING btree (user_id, status);


--
-- Name: idx_collab_delivery_docs_delivery; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collab_delivery_docs_delivery ON public.collab_delivery_docs USING btree (delivery_id);


--
-- Name: idx_collab_events_delivery; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collab_events_delivery ON public.collab_delivery_events USING btree (delivery_id, created_at DESC);


--
-- Name: idx_collab_renewal_delivery; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collab_renewal_delivery ON public.collab_renewal_schedule USING btree (delivery_id);


--
-- Name: idx_collab_renewal_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collab_renewal_pending ON public.collab_renewal_schedule USING btree (scheduled_date) WHERE (status = 'pending'::text);


--
-- Name: idx_collab_sessions_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collab_sessions_category ON public.collab_delivery_sessions USING btree (category, session_date DESC);


--
-- Name: idx_collab_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collab_sessions_user ON public.collab_delivery_sessions USING btree (user_id, session_date DESC);


--
-- Name: idx_collaborator_documents_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collaborator_documents_category ON public.collaborator_documents USING btree (category);


--
-- Name: idx_collaborator_documents_group_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collaborator_documents_group_key ON public.collaborator_documents USING btree (group_key);


--
-- Name: idx_collaborator_documents_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collaborator_documents_is_active ON public.collaborator_documents USING btree (user_id, is_active);


--
-- Name: idx_collaborator_documents_owner_area; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collaborator_documents_owner_area ON public.collaborator_documents USING btree (owner_area);


--
-- Name: idx_collaborator_documents_source_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collaborator_documents_source_channel ON public.collaborator_documents USING btree (source_channel);


--
-- Name: idx_collaborator_documents_user_doc_active_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collaborator_documents_user_doc_active_lookup ON public.collaborator_documents USING btree (user_id, doc_type, is_active, created_at DESC);


--
-- Name: idx_collaborator_qualifications_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collaborator_qualifications_active ON public.collaborator_qualifications USING btree (user_id, is_active);


--
-- Name: idx_collaborator_qualifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collaborator_qualifications_created_at ON public.collaborator_qualifications USING btree (created_at DESC);


--
-- Name: idx_collaborator_qualifications_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collaborator_qualifications_type ON public.collaborator_qualifications USING btree (qualification_type);


--
-- Name: idx_collaborator_qualifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collaborator_qualifications_user_id ON public.collaborator_qualifications USING btree (user_id);


--
-- Name: idx_competitor_opportunity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_competitor_opportunity_id ON public.competitor USING btree (opportunity_id);


--
-- Name: idx_consumable_dispatch_lines_order_line_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumable_dispatch_lines_order_line_id ON public.consumable_dispatch_lines USING btree (consumable_order_line_id, dispatched_at DESC);


--
-- Name: idx_consumable_dispatch_lines_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumable_dispatch_lines_pending ON public.consumable_dispatch_lines USING btree (consumable_order_id, carried_forward_order_id) WHERE (pending_units > (0)::numeric);


--
-- Name: idx_consumable_file_lines_catalog; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumable_file_lines_catalog ON public.consumable_file_lines USING btree (catalog_consumable_id) WHERE (catalog_consumable_id IS NOT NULL);


--
-- Name: idx_consumable_file_lines_section_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumable_file_lines_section_id ON public.consumable_file_lines USING btree (consumable_file_section_id, item_type, item_name);


--
-- Name: idx_consumable_file_sections_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumable_file_sections_file_id ON public.consumable_file_sections USING btree (consumable_file_id, sort_order, id);


--
-- Name: idx_consumable_files_business_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumable_files_business_case_id ON public.consumable_files USING btree (business_case_id) WHERE (business_case_id IS NOT NULL);


--
-- Name: idx_consumable_files_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumable_files_status ON public.consumable_files USING btree (status);


--
-- Name: idx_consumable_order_lines_file_line_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumable_order_lines_file_line_id ON public.consumable_order_lines USING btree (consumable_file_line_id);


--
-- Name: idx_consumable_order_lines_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumable_order_lines_order_id ON public.consumable_order_lines USING btree (consumable_order_id, id);


--
-- Name: idx_consumable_orders_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumable_orders_file_id ON public.consumable_orders USING btree (consumable_file_id, created_at DESC);


--
-- Name: idx_consumable_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumable_orders_status ON public.consumable_orders USING btree (status, created_at DESC);


--
-- Name: idx_consumption_log_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumption_log_contract ON public.determination_consumption_log USING btree (contract_determination_id);


--
-- Name: idx_consumption_log_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumption_log_date ON public.determination_consumption_log USING btree (consumption_date);


--
-- Name: idx_consumption_log_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumption_log_user ON public.determination_consumption_log USING btree (consumed_by_user_id);


--
-- Name: idx_contacts_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_account_id ON public.contacts USING btree (account_id);


--
-- Name: idx_contacts_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_email ON public.contacts USING btree (lower((email)::text));


--
-- Name: idx_contacts_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_name ON public.contacts USING btree (lower((full_name)::text));


--
-- Name: idx_contract_det_bc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_det_bc ON public.contract_determinations USING btree (business_case_id);


--
-- Name: idx_contract_det_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_det_client ON public.contract_determinations USING btree (client_id);


--
-- Name: idx_contract_det_determination; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_det_determination ON public.contract_determinations USING btree (determination_id);


--
-- Name: idx_contract_det_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_det_status ON public.contract_determinations USING btree (status);


--
-- Name: idx_delivery_ceiling_audit_business_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_ceiling_audit_business_case ON public.delivery_ceiling_audit USING btree (business_case_id, at DESC);


--
-- Name: idx_delivery_ceiling_audit_ceiling; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_ceiling_audit_ceiling ON public.delivery_ceiling_audit USING btree (delivery_ceiling_id, at DESC);


--
-- Name: idx_delivery_ceiling_business_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_ceiling_business_case ON public.delivery_ceiling USING btree (business_case_id, updated_at DESC);


--
-- Name: idx_delivery_ceiling_line_ceiling; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_ceiling_line_ceiling ON public.delivery_ceiling_line USING btree (delivery_ceiling_id, id DESC);


--
-- Name: idx_delivery_ceiling_line_item_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_ceiling_line_item_type ON public.delivery_ceiling_line USING btree (item_type);


--
-- Name: idx_delivery_ceiling_private_purchase_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_ceiling_private_purchase_id ON public.delivery_ceiling USING btree (private_purchase_id) WHERE (private_purchase_id IS NOT NULL);


--
-- Name: idx_delivery_ceiling_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_ceiling_status ON public.delivery_ceiling USING btree (status, updated_at DESC);


--
-- Name: idx_delivery_request_ceiling_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_request_ceiling_status ON public.delivery_request USING btree (delivery_ceiling_id, status, id DESC);


--
-- Name: idx_delivery_request_line_ceiling_line; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_request_line_ceiling_line ON public.delivery_request_line USING btree (delivery_ceiling_line_id, delivery_request_id);


--
-- Name: idx_delivery_request_requested_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_request_requested_at ON public.delivery_request USING btree (requested_at DESC);


--
-- Name: idx_departments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_status ON public.departments USING btree (status);


--
-- Name: idx_document_hashes_current; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_hashes_current ON public.document_hashes USING btree (document_id, is_current) WHERE (is_current = true);


--
-- Name: idx_document_hashes_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_hashes_document_id ON public.document_hashes USING btree (document_id);


--
-- Name: idx_document_qr_codes_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_qr_codes_active ON public.document_qr_codes USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_document_qr_codes_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_qr_codes_document_id ON public.document_qr_codes USING btree (document_id);


--
-- Name: idx_document_qr_codes_seal_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_qr_codes_seal_id ON public.document_qr_codes USING btree (seal_id);


--
-- Name: idx_document_qr_codes_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_qr_codes_token ON public.document_qr_codes USING btree (verification_token);


--
-- Name: idx_document_qr_codes_verification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_qr_codes_verification ON public.document_qr_codes USING btree (document_id, is_active, verification_token);


--
-- Name: idx_document_seals_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_seals_active ON public.document_seals USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_document_seals_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_seals_document_id ON public.document_seals USING btree (document_id);


--
-- Name: idx_document_seals_seal_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_seals_seal_code ON public.document_seals USING btree (seal_code);


--
-- Name: idx_document_seals_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_seals_token ON public.document_seals USING btree (seal_token);


--
-- Name: idx_document_seals_verification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_seals_verification ON public.document_seals USING btree (document_id, is_active, seal_token);


--
-- Name: idx_document_signatures_advanced_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_signatures_advanced_document_id ON public.document_signatures_advanced USING btree (document_id);


--
-- Name: idx_document_signatures_advanced_signed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_signatures_advanced_signed_at ON public.document_signatures_advanced USING btree (signed_at DESC);


--
-- Name: idx_document_signatures_advanced_signer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_signatures_advanced_signer ON public.document_signatures_advanced USING btree (signer_user_id);


--
-- Name: idx_document_signatures_advanced_valid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_signatures_advanced_valid ON public.document_signatures_advanced USING btree (is_valid) WHERE (is_valid = true);


--
-- Name: idx_documents_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_request_id ON public.documents USING btree (request_id);


--
-- Name: idx_employee_contracts_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_contracts_department ON public.employee_contracts USING btree (departamento_id);


--
-- Name: idx_employee_contracts_fecha_fin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_contracts_fecha_fin ON public.employee_contracts USING btree (fecha_fin);


--
-- Name: idx_employee_contracts_fecha_inicio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_contracts_fecha_inicio ON public.employee_contracts USING btree (fecha_inicio);


--
-- Name: idx_employee_contracts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_contracts_status ON public.employee_contracts USING btree (status);


--
-- Name: idx_employee_contracts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_contracts_type ON public.employee_contracts USING btree (contract_type);


--
-- Name: idx_employee_contracts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_contracts_user_id ON public.employee_contracts USING btree (user_id);


--
-- Name: idx_ep_bc_links_business_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_ep_bc_links_business_case_id ON public.equipment_purchase_business_case_links USING btree (business_case_id);


--
-- Name: idx_epr_availability_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_epr_availability_status ON public.equipment_purchase_requests USING btree (availability_status) WHERE (availability_status <> 'not_checked'::text);


--
-- Name: idx_epr_participation_decision; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_epr_participation_decision ON public.equipment_purchase_requests USING btree (participation_decision) WHERE (participation_decision IS NOT NULL);


--
-- Name: idx_epr_procedure_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_epr_procedure_type ON public.equipment_purchase_requests USING btree (procedure_type) WHERE (procedure_type IS NOT NULL);


--
-- Name: idx_epr_purchase_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_epr_purchase_type ON public.equipment_purchase_requests USING btree (purchase_type) WHERE (purchase_type IS NOT NULL);


--
-- Name: idx_epr_requires_business_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_epr_requires_business_case ON public.equipment_purchase_requests USING btree (requires_business_case) WHERE (requires_business_case IS NOT NULL);


--
-- Name: idx_epr_serial_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_epr_serial_status ON public.equipment_purchase_requests USING btree (serial_status) WHERE (serial_status <> 'not_applicable_yet'::text);


--
-- Name: idx_epr_sla_state_entered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_epr_sla_state_entered ON public.equipment_purchase_requests USING btree (canonical_state, entered_state_at) WHERE ((canonical_state)::text <> ALL ((ARRAY['CANCELADO'::character varying, 'RECHAZADO_POR_GERENCIA'::character varying])::text[]));


--
-- Name: idx_epr_soce_process_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_epr_soce_process_code ON public.equipment_purchase_requests USING btree (soce_process_code) WHERE (soce_process_code IS NOT NULL);


--
-- Name: idx_epr_supply_control_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_epr_supply_control_type ON public.equipment_purchase_requests USING btree (supply_control_type) WHERE (supply_control_type IS NOT NULL);


--
-- Name: idx_eq_cons_determination; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eq_cons_determination ON public.catalog_equipment_consumables USING btree (determination_id);


--
-- Name: idx_eq_cons_equipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eq_cons_equipment ON public.catalog_equipment_consumables USING btree (equipment_id);


--
-- Name: idx_equipment_asset_events_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_asset_events_asset ON public.equipment_asset_events USING btree (asset_id, created_at DESC);


--
-- Name: idx_equipment_asset_reservations_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_asset_reservations_asset ON public.equipment_asset_reservations USING btree (asset_id, status);


--
-- Name: idx_equipment_asset_schedule_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_asset_schedule_due ON public.equipment_asset_maintenance_schedule USING btree (scheduled_for, status);


--
-- Name: idx_equipment_assets_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_assets_client ON public.equipment_assets USING btree (client_id, client_location_id);


--
-- Name: idx_equipment_assets_model_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_assets_model_status ON public.equipment_assets USING btree (equipment_model_id, current_status);


--
-- Name: idx_equipment_maintenance_parts_equipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_maintenance_parts_equipment ON public.equipment_maintenance_parts USING btree (equipment_model_id);


--
-- Name: idx_equipment_models_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_models_name ON public.equipment_models USING btree (name);


--
-- Name: idx_equipment_models_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_models_status ON public.equipment_models USING btree (status);


--
-- Name: idx_equipment_purchase_business_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_purchase_business_case ON public.equipment_purchase_requests USING btree (business_case_id);


--
-- Name: idx_equipment_purchase_contract_reminder_email_sent_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_purchase_contract_reminder_email_sent_at ON public.equipment_purchase_requests USING btree (contract_reminder_email_sent_at);


--
-- Name: idx_equipment_purchase_forwarded_to_acp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_purchase_forwarded_to_acp ON public.equipment_purchase_requests USING btree (forwarded_to_acp_at);


--
-- Name: idx_equipment_purchase_provider_contacts_last_used; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_purchase_provider_contacts_last_used ON public.equipment_purchase_provider_contacts USING btree (last_used_at DESC, updated_at DESC);


--
-- Name: idx_equipment_purchase_requests_commercial_certainty; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_purchase_requests_commercial_certainty ON public.equipment_purchase_requests USING btree (commercial_certainty) WHERE (commercial_certainty = true);


--
-- Name: idx_equipment_purchase_requests_modern; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_purchase_requests_modern ON public.equipment_purchase_requests USING btree (uses_modern_system) WHERE (uses_modern_system = true);


--
-- Name: idx_equipment_purchase_requests_opportunity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_purchase_requests_opportunity ON public.equipment_purchase_requests USING btree (opportunity_id);


--
-- Name: idx_equipment_purchase_requests_proforma_signed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_purchase_requests_proforma_signed_at ON public.equipment_purchase_requests USING btree (proforma_signed_at) WHERE (proforma_signed_at IS NOT NULL);


--
-- Name: idx_equipment_purchase_requests_system_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_purchase_requests_system_type ON public.equipment_purchase_requests USING btree (bc_system_type) WHERE ((bc_system_type)::text = 'modern'::text);


--
-- Name: idx_equipment_purchase_requests_v2_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_purchase_requests_v2_request_id ON public.equipment_purchase_requests USING btree (v2_request_id) WHERE (v2_request_id IS NOT NULL);


--
-- Name: idx_equipment_purchase_status_unified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_purchase_status_unified ON public.equipment_purchase_requests USING btree (status_unified);


--
-- Name: idx_famdays_event_qr_tokens_event_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_famdays_event_qr_tokens_event_active ON public.famdays_event_qr_tokens USING btree (event_id, is_active);


--
-- Name: idx_integration_outbox_correlation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integration_outbox_correlation ON public.integration_outbox USING btree (correlation_id);


--
-- Name: idx_integration_outbox_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integration_outbox_event_type ON public.integration_outbox USING btree (event_type, created_at DESC);


--
-- Name: idx_integration_outbox_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integration_outbox_status_created ON public.integration_outbox USING btree (status, created_at, id);


--
-- Name: idx_integration_product_map_active_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integration_product_map_active_updated ON public.integration_product_map USING btree (active, updated_at DESC);


--
-- Name: idx_integration_product_map_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integration_product_map_category ON public.integration_product_map USING btree (business_category, updated_at DESC);


--
-- Name: idx_inventory_movements_inventory; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_movements_inventory ON public.inventory_movements USING btree (inventory_id);


--
-- Name: idx_kar_aporte; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kar_aporte ON public.kickoff_aporte_ratings USING btree (aporte_id);


--
-- Name: idx_kickoff_blocks_presentation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kickoff_blocks_presentation_id ON public.kickoff_presentation_blocks USING btree (presentation_id);


--
-- Name: idx_kickoff_blocks_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kickoff_blocks_sort ON public.kickoff_presentation_blocks USING btree (presentation_id, sort_order);


--
-- Name: idx_kickoff_events_event_type_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kickoff_events_event_type_status ON public.kickoff_events USING btree (event_type, status, event_date);


--
-- Name: idx_kickoff_presentations_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kickoff_presentations_event_id ON public.kickoff_presentations USING btree (event_id);


--
-- Name: idx_kickoff_presentations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kickoff_presentations_status ON public.kickoff_presentations USING btree (status);


--
-- Name: idx_kickoff_qr_presentation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kickoff_qr_presentation_id ON public.kickoff_qr_tokens USING btree (presentation_id);


--
-- Name: idx_kickoff_qr_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kickoff_qr_token ON public.kickoff_qr_tokens USING btree (token);


--
-- Name: idx_kickoff_questions_presentation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kickoff_questions_presentation ON public.kickoff_questions USING btree (presentation_id);


--
-- Name: idx_kickoff_questions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kickoff_questions_status ON public.kickoff_questions USING btree (status);


--
-- Name: idx_kpr_presentation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kpr_presentation ON public.kickoff_presentation_ratings USING btree (presentation_id);


--
-- Name: idx_kqr_question; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kqr_question ON public.kickoff_question_ratings USING btree (question_id);


--
-- Name: idx_location_history_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_location_history_activity ON public.advisor_location_history USING btree (activity_type);


--
-- Name: idx_location_history_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_location_history_client ON public.advisor_location_history USING btree (client_request_id);


--
-- Name: idx_location_history_user_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_location_history_user_time ON public.advisor_location_history USING btree (user_email, "timestamp" DESC);


--
-- Name: idx_maintenance_procedures_model; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_maintenance_procedures_model ON public.maintenance_procedures USING btree (equipment_model_id, maintenance_type, is_active);


--
-- Name: idx_notification_dispatch_queue_notification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_dispatch_queue_notification ON public.notification_dispatch_queue USING btree (notification_id);


--
-- Name: idx_notification_dispatch_queue_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_dispatch_queue_pending ON public.notification_dispatch_queue USING btree (status, next_retry_at);


--
-- Name: idx_notification_dispatch_queue_permanently_failed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_dispatch_queue_permanently_failed ON public.notification_dispatch_queue USING btree (status, created_at DESC) WHERE ((status)::text = 'permanently_failed'::text);


--
-- Name: idx_notification_dispatch_queue_process_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_dispatch_queue_process_key ON public.notification_dispatch_queue USING btree (process_key, id);


--
-- Name: idx_notification_dispatch_queue_process_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_dispatch_queue_process_pending ON public.notification_dispatch_queue USING btree (process_key, status, next_retry_at, id);


--
-- Name: idx_notification_process_email_threads_last_sent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_process_email_threads_last_sent ON public.notification_process_email_threads USING btree (last_sent_at DESC);


--
-- Name: idx_notifications_cleared; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_cleared ON public.notifications USING btree (user_id, cleared_at) WHERE (cleared_at IS NULL);


--
-- Name: idx_notifications_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_status ON public.notifications USING btree (status);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);


--
-- Name: idx_offboarding_tasks_user_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offboarding_tasks_user_stage ON public.offboarding_tasks USING btree (user_id, stage);


--
-- Name: idx_opportunity_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunity_account_id ON public.opportunity USING btree (account_id);


--
-- Name: idx_opportunity_flag_opportunity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunity_flag_opportunity_id ON public.opportunity_flag USING btree (opportunity_id);


--
-- Name: idx_opportunity_flag_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunity_flag_status ON public.opportunity_flag USING btree (status);


--
-- Name: idx_opportunity_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunity_owner_id ON public.opportunity USING btree (owner_id);


--
-- Name: idx_opportunity_process_link_opp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunity_process_link_opp ON public.opportunity_process_link USING btree (opportunity_id);


--
-- Name: idx_opportunity_process_link_proc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunity_process_link_proc ON public.opportunity_process_link USING btree (process_type, process_id);


--
-- Name: idx_opportunity_snapshot_opportunity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunity_snapshot_opportunity_id ON public.opportunity_snapshot USING btree (opportunity_id, created_at DESC);


--
-- Name: idx_opportunity_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunity_stage ON public.opportunity USING btree (funnel_stage);


--
-- Name: idx_opportunity_target_close_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunity_target_close_date ON public.opportunity USING btree (target_close_date);


--
-- Name: idx_permisos_approver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permisos_approver ON public.permisos_vacaciones USING btree (approver_role);


--
-- Name: idx_permisos_firmas_signer_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permisos_firmas_signer_user ON public.permisos_vacaciones_firmas USING btree (signer_user_id, signed_at DESC);


--
-- Name: idx_permisos_firmas_solicitud_signed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permisos_firmas_solicitud_signed_at ON public.permisos_vacaciones_firmas USING btree (solicitud_id, signed_at DESC, id DESC);


--
-- Name: idx_permisos_firmas_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permisos_firmas_stage ON public.permisos_vacaciones_firmas USING btree (stage, signed_at DESC);


--
-- Name: idx_permisos_matriculas_approver_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permisos_matriculas_approver_status ON public.permisos_estudios_matriculas USING btree (approver_user_id, approver_role, status, created_at DESC);


--
-- Name: idx_permisos_matriculas_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permisos_matriculas_user_status ON public.permisos_estudios_matriculas USING btree (user_id, status, valid_until DESC);


--
-- Name: idx_permisos_recovery_plan_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permisos_recovery_plan_updated_at ON public.permisos_vacaciones USING btree (recovery_plan_updated_at DESC) WHERE (recovery_plan IS NOT NULL);


--
-- Name: idx_permisos_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permisos_status ON public.permisos_vacaciones USING btree (status);


--
-- Name: idx_permisos_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permisos_tipo ON public.permisos_vacaciones USING btree (tipo_solicitud);


--
-- Name: idx_permisos_user_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permisos_user_email ON public.permisos_vacaciones USING btree (user_email);


--
-- Name: idx_permisos_vacaciones_cancellation_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permisos_vacaciones_cancellation_status ON public.permisos_vacaciones USING btree (cancellation_status, updated_at DESC);


--
-- Name: idx_personnel_request_comments_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personnel_request_comments_request ON public.personnel_request_comments USING btree (personnel_request_id);


--
-- Name: idx_personnel_request_history_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personnel_request_history_request ON public.personnel_request_history USING btree (personnel_request_id);


--
-- Name: idx_personnel_requests_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personnel_requests_created_at ON public.personnel_requests USING btree (created_at DESC);


--
-- Name: idx_personnel_requests_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personnel_requests_department ON public.personnel_requests USING btree (department_id);


--
-- Name: idx_personnel_requests_requester; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personnel_requests_requester ON public.personnel_requests USING btree (requester_id);


--
-- Name: idx_personnel_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personnel_requests_status ON public.personnel_requests USING btree (status);


--
-- Name: idx_pipeline_entries_applicant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_entries_applicant ON public.applicant_pipeline_entries USING btree (applicant_id);


--
-- Name: idx_pipeline_entries_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_entries_request ON public.applicant_pipeline_entries USING btree (request_id);


--
-- Name: idx_pipeline_entries_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_entries_status ON public.applicant_pipeline_entries USING btree (status);


--
-- Name: idx_pipeline_stages_entry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_stages_entry ON public.applicant_stage_results USING btree (entry_id);


--
-- Name: idx_ppr_serial_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ppr_serial_status ON public.private_purchase_requests USING btree (serial_status) WHERE (serial_status <> 'not_applicable_yet'::text);


--
-- Name: idx_ppr_supply_control_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ppr_supply_control_type ON public.private_purchase_requests USING btree (supply_control_type) WHERE (supply_control_type IS NOT NULL);


--
-- Name: idx_price_history_consumable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_history_consumable ON public.equipment_price_history USING btree (consumable_id) WHERE (consumable_id IS NOT NULL);


--
-- Name: idx_price_history_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_history_dates ON public.equipment_price_history USING btree (effective_from, effective_to);


--
-- Name: idx_price_history_equipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_history_equipment ON public.equipment_price_history USING btree (equipment_id) WHERE (equipment_id IS NOT NULL);


--
-- Name: idx_private_purchase_inspection_coordination; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_private_purchase_inspection_coordination ON public.private_purchase_requests USING btree (status, inspection_request_id, inspection_scheduled_date);


--
-- Name: idx_private_purchase_installation_workflow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_private_purchase_installation_workflow ON public.private_purchase_requests USING gin (installation_workflow);


--
-- Name: idx_private_purchase_paused_reason; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_private_purchase_paused_reason ON public.private_purchase_requests USING btree (paused_reason) WHERE (paused_reason IS NOT NULL);


--
-- Name: idx_private_purchase_requests_opportunity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_private_purchase_requests_opportunity ON public.private_purchase_requests USING btree (opportunity_id);


--
-- Name: idx_private_purchase_site_inspection_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_private_purchase_site_inspection_status ON public.private_purchase_requests USING btree (site_inspection_status, site_inspection_ready_for_installation);


--
-- Name: idx_prospect_visits_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_visits_lead_id ON public.prospect_visits USING btree (lead_id);


--
-- Name: idx_prospect_visits_user_date_report; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_visits_user_date_report ON public.prospect_visits USING btree (user_email, visit_date);


--
-- Name: idx_prospect_visits_user_lower_date_report; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_visits_user_lower_date_report ON public.prospect_visits USING btree (lower(COALESCE(user_email, ''::text)), visit_date);


--
-- Name: idx_public_delivery_plan_ceiling_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_delivery_plan_ceiling_status ON public.public_delivery_plan USING btree (delivery_ceiling_id, status, id DESC);


--
-- Name: idx_public_delivery_plan_line_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_delivery_plan_line_lookup ON public.public_delivery_plan_line USING btree (delivery_ceiling_line_id, scheduled_start, scheduled_end);


--
-- Name: idx_purchase_corrections_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_corrections_created_at ON public.purchase_corrections USING btree (created_at DESC);


--
-- Name: idx_purchase_corrections_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_corrections_created_by ON public.purchase_corrections USING btree (created_by_user_id);


--
-- Name: idx_purchase_corrections_purchase_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_corrections_purchase_id ON public.purchase_corrections USING btree (private_purchase_id);


--
-- Name: idx_purchase_corrections_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_corrections_status ON public.purchase_corrections USING btree (status);


--
-- Name: idx_purchase_delivery_schedules_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_delivery_schedules_dates ON public.purchase_delivery_schedules USING btree (delivery_start_at, delivery_end_at);


--
-- Name: idx_purchase_delivery_schedules_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_delivery_schedules_request_id ON public.purchase_delivery_schedules USING btree (private_purchase_request_id);


--
-- Name: idx_pv_is_urgent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pv_is_urgent ON public.permisos_vacaciones USING btree (is_urgent, status) WHERE (is_urgent = true);


--
-- Name: idx_request_approvals_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_approvals_pending ON public.request_approvals USING btree (used, token_expires_at);


--
-- Name: idx_request_attachments_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_attachments_request ON public.request_attachments USING btree (request_id);


--
-- Name: idx_request_types_schema_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_types_schema_gin ON public.request_types USING gin (schema);


--
-- Name: idx_requests_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_created_at ON public.requests USING btree (created_at);


--
-- Name: idx_requests_drive_comercial_folder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_drive_comercial_folder ON public.requests USING btree (drive_comercial_folder_id) WHERE (drive_comercial_folder_id IS NOT NULL);


--
-- Name: idx_requests_drive_request_folder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_drive_request_folder ON public.requests USING btree (drive_request_folder_id) WHERE (drive_request_folder_id IS NOT NULL);


--
-- Name: idx_requests_drive_type_folder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_drive_type_folder ON public.requests USING btree (drive_type_folder_id) WHERE (drive_type_folder_id IS NOT NULL);


--
-- Name: idx_requests_drive_user_folder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_drive_user_folder ON public.requests USING btree (drive_user_folder_id) WHERE (drive_user_folder_id IS NOT NULL);


--
-- Name: idx_requests_legacy_purchase_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_legacy_purchase_id ON public.requests USING btree (legacy_purchase_id) WHERE (legacy_purchase_id IS NOT NULL);


--
-- Name: idx_requests_payload_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_payload_gin ON public.requests USING gin (payload);


--
-- Name: idx_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_status ON public.requests USING btree (status);


--
-- Name: idx_rsh_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rsh_request_id ON public.request_status_history USING btree (request_id);


--
-- Name: idx_salary_proposals_entry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_salary_proposals_entry ON public.hiring_salary_proposals USING btree (entry_id);


--
-- Name: idx_scheduled_visits_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_visits_city ON public.scheduled_visits USING btree (city);


--
-- Name: idx_scheduled_visits_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_visits_date ON public.scheduled_visits USING btree (planned_date);


--
-- Name: idx_scheduled_visits_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_visits_lead_id ON public.scheduled_visits USING btree (lead_id);


--
-- Name: idx_scheduled_visits_schedule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_visits_schedule ON public.scheduled_visits USING btree (schedule_id);


--
-- Name: idx_signature_workflow_documents_current; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_signature_workflow_documents_current ON public.signature_workflow_documents USING btree (workflow_id, is_current);


--
-- Name: idx_signature_workflow_documents_workflow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_signature_workflow_documents_workflow ON public.signature_workflow_documents USING btree (workflow_id, created_at DESC);


--
-- Name: idx_signature_workflow_events_workflow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_signature_workflow_events_workflow ON public.signature_workflow_events USING btree (workflow_id, created_at DESC);


--
-- Name: idx_signature_workflow_signers_available_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_signature_workflow_signers_available_at ON public.signature_workflow_signers USING btree (available_at);


--
-- Name: idx_signature_workflow_signers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_signature_workflow_signers_status ON public.signature_workflow_signers USING btree (status);


--
-- Name: idx_signature_workflow_signers_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_signature_workflow_signers_user ON public.signature_workflow_signers USING btree (user_id);


--
-- Name: idx_signature_workflow_signers_workflow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_signature_workflow_signers_workflow ON public.signature_workflow_signers USING btree (workflow_id, sequence_order);


--
-- Name: idx_signature_workflows_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_signature_workflows_created_at ON public.signature_workflows USING btree (created_at DESC);


--
-- Name: idx_signature_workflows_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_signature_workflows_created_by ON public.signature_workflows USING btree (created_by);


--
-- Name: idx_signature_workflows_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_signature_workflows_source ON public.signature_workflows USING btree (source_module, source_entity, source_entity_id);


--
-- Name: idx_signature_workflows_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_signature_workflows_status ON public.signature_workflows USING btree (status);


--
-- Name: idx_support_ticket_attachments_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_ticket_attachments_ticket ON public.support_ticket_attachments USING btree (ticket_id, created_at, id);


--
-- Name: idx_support_ticket_attachments_uploaded_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_ticket_attachments_uploaded_by ON public.support_ticket_attachments USING btree (uploaded_by);


--
-- Name: idx_support_ticket_comments_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_ticket_comments_ticket ON public.support_ticket_comments USING btree (ticket_id, created_at DESC);


--
-- Name: idx_support_ticket_comments_visibility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_ticket_comments_visibility ON public.support_ticket_comments USING btree (visibility);


--
-- Name: idx_support_ticket_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_ticket_events_created_at ON public.support_ticket_events USING btree (created_at DESC);


--
-- Name: idx_support_ticket_events_ticket_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_ticket_events_ticket_id ON public.support_ticket_events USING btree (ticket_id);


--
-- Name: idx_support_tickets_assigned_ti; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_assigned_ti ON public.support_tickets USING btree (assigned_ti_user_id);


--
-- Name: idx_support_tickets_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_category ON public.support_tickets USING btree (category);


--
-- Name: idx_support_tickets_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_created_at ON public.support_tickets USING btree (created_at DESC);


--
-- Name: idx_support_tickets_requester_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_requester_id ON public.support_tickets USING btree (requester_id);


--
-- Name: idx_support_tickets_resolution_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_resolution_due ON public.support_tickets USING btree (resolution_due_at);


--
-- Name: idx_support_tickets_response_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_response_due ON public.support_tickets USING btree (first_response_due_at);


--
-- Name: idx_support_tickets_sla_resolution_breached; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_sla_resolution_breached ON public.support_tickets USING btree (sla_resolution_breached);


--
-- Name: idx_support_tickets_sla_response_breached; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_sla_response_breached ON public.support_tickets USING btree (sla_response_breached);


--
-- Name: idx_support_tickets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_status ON public.support_tickets USING btree (status);


--
-- Name: idx_support_tickets_ticket_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_ticket_type ON public.support_tickets USING btree (ticket_type);


--
-- Name: idx_tech_docs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tech_docs_created ON public.technical_documents USING btree (created_at DESC);


--
-- Name: idx_tech_docs_equipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tech_docs_equipment ON public.technical_documents USING btree (equipment_name);


--
-- Name: idx_tech_docs_serial; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tech_docs_serial ON public.technical_documents USING btree (equipment_serial);


--
-- Name: idx_tech_docs_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tech_docs_type ON public.technical_documents USING btree (document_type);


--
-- Name: idx_tech_docs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tech_docs_user ON public.technical_documents USING btree (user_id);


--
-- Name: idx_ti_accessories_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ti_accessories_asset ON public.ti_asset_accessories USING btree (asset_id, active);


--
-- Name: idx_ti_actas_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ti_actas_asset ON public.ti_asset_actas USING btree (asset_id);


--
-- Name: idx_ti_actas_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ti_actas_generated ON public.ti_asset_actas USING btree (generated_at DESC);


--
-- Name: idx_ti_actas_items_acta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ti_actas_items_acta ON public.ti_asset_actas_items USING btree (acta_id);


--
-- Name: idx_ti_asset_assignments_asset_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ti_asset_assignments_asset_user ON public.ti_asset_assignments USING btree (asset_id, assigned_to_user_id);


--
-- Name: idx_ti_asset_events_asset_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ti_asset_events_asset_date ON public.ti_asset_events USING btree (asset_id, created_at DESC);


--
-- Name: idx_ti_asset_financial_docs_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ti_asset_financial_docs_assignment ON public.ti_asset_financial_docs USING btree (assignment_id);


--
-- Name: idx_ti_asset_financial_docs_invoice_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ti_asset_financial_docs_invoice_number ON public.ti_asset_financial_docs USING btree (invoice_number);


--
-- Name: idx_ti_asset_financial_docs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ti_asset_financial_docs_user ON public.ti_asset_financial_docs USING btree (assigned_user_id);


--
-- Name: idx_ti_asset_liberation_photos_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ti_asset_liberation_photos_asset ON public.ti_asset_liberation_photos USING btree (asset_id);


--
-- Name: idx_ti_asset_liberation_photos_liberated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ti_asset_liberation_photos_liberated_at ON public.ti_asset_liberation_photos USING btree (liberated_at DESC);


--
-- Name: idx_ti_asset_schedule_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ti_asset_schedule_year ON public.ti_asset_maintenance_schedule USING btree (year, status);


--
-- Name: idx_ti_assets_assigned_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ti_assets_assigned_user ON public.ti_assets USING btree (assigned_to_user_id);


--
-- Name: idx_ti_assets_purchase_value; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ti_assets_purchase_value ON public.ti_assets USING btree (purchase_value);


--
-- Name: idx_ti_assets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ti_assets_status ON public.ti_assets USING btree (status);


--
-- Name: idx_ti_assets_value_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ti_assets_value_category ON public.ti_assets USING btree (value_category);


--
-- Name: idx_ti_corporate_number_history_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ti_corporate_number_history_changed_at ON public.ti_corporate_number_history USING btree (changed_at DESC);


--
-- Name: idx_ti_corporate_number_history_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ti_corporate_number_history_number ON public.ti_corporate_number_history USING btree (number_id);


--
-- Name: idx_ti_corporate_numbers_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ti_corporate_numbers_asset ON public.ti_corporate_numbers USING btree (asset_id);


--
-- Name: idx_ti_corporate_numbers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ti_corporate_numbers_status ON public.ti_corporate_numbers USING btree (status);


--
-- Name: idx_ti_corporate_numbers_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ti_corporate_numbers_user ON public.ti_corporate_numbers USING btree (assigned_to_user_id);


--
-- Name: idx_ti_financial_docs_asset_type; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_ti_financial_docs_asset_type ON public.ti_asset_financial_docs USING btree (asset_id, doc_type) WHERE (active = true);


--
-- Name: idx_ti_financial_docs_asset_type_factura; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_ti_financial_docs_asset_type_factura ON public.ti_asset_financial_docs USING btree (asset_id, doc_type) WHERE ((active = true) AND (doc_type = 'factura'::text));


--
-- Name: idx_ti_maintenance_reports_generated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ti_maintenance_reports_generated_at ON public.ti_maintenance_reports USING btree (generated_at DESC);


--
-- Name: idx_ti_maintenance_reports_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ti_maintenance_reports_period ON public.ti_maintenance_reports USING btree (period);


--
-- Name: idx_training_attendees_attendance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_attendees_attendance ON public.training_attendees USING btree (training_id, attendance_status);


--
-- Name: idx_training_attendees_training; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_attendees_training ON public.training_attendees USING btree (training_id);


--
-- Name: idx_training_attendees_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_attendees_user ON public.training_attendees USING btree (user_id);


--
-- Name: idx_trainings_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trainings_created_by ON public.trainings USING btree (created_by);


--
-- Name: idx_trainings_scheduled_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trainings_scheduled_date ON public.trainings USING btree (scheduled_date);


--
-- Name: idx_trainings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trainings_status ON public.trainings USING btree (status) WHERE (active = true);


--
-- Name: idx_trainings_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trainings_type ON public.trainings USING btree (type);


--
-- Name: idx_travel_allowance_documents_allowance_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_travel_allowance_documents_allowance_id ON public.travel_allowance_documents USING btree (allowance_id);


--
-- Name: idx_travel_allowance_documents_doc_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_travel_allowance_documents_doc_type ON public.travel_allowance_documents USING btree (doc_type);


--
-- Name: idx_travel_allowance_fixed_profiles_user_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_travel_allowance_fixed_profiles_user_dates ON public.travel_allowance_fixed_profiles USING btree (user_id, fecha_inicio, fecha_fin);


--
-- Name: idx_travel_allowance_invoices_allowance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_travel_allowance_invoices_allowance ON public.travel_allowance_invoices USING btree (allowance_id);


--
-- Name: idx_travel_allowance_invoices_document_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_travel_allowance_invoices_document_type ON public.travel_allowance_invoices USING btree (document_type);


--
-- Name: idx_travel_allowance_purchases_no_invoice_allowance_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_travel_allowance_purchases_no_invoice_allowance_id ON public.travel_allowance_purchases_no_invoice USING btree (allowance_id);


--
-- Name: idx_travel_allowance_purchases_no_invoice_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_travel_allowance_purchases_no_invoice_status ON public.travel_allowance_purchases_no_invoice USING btree (status);


--
-- Name: idx_travel_allowance_segment_events_allowance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_travel_allowance_segment_events_allowance ON public.travel_allowance_segment_events USING btree (allowance_id, created_at DESC);


--
-- Name: idx_travel_allowance_segment_events_segment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_travel_allowance_segment_events_segment ON public.travel_allowance_segment_events USING btree (segment_id, created_at DESC) WHERE (segment_id IS NOT NULL);


--
-- Name: idx_travel_allowance_segments_allowance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_travel_allowance_segments_allowance ON public.travel_allowance_segments USING btree (allowance_id);


--
-- Name: idx_travel_allowance_segments_queue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_travel_allowance_segments_queue ON public.travel_allowance_segments USING btree (segment_type, workflow_status, visible_in_active_queue);


--
-- Name: idx_travel_allowances_deadline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_travel_allowances_deadline ON public.travel_allowances USING btree (grace_deadline_at) WHERE (grace_deadline_at IS NOT NULL);


--
-- Name: idx_travel_allowances_processed_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_travel_allowances_processed_month ON public.travel_allowances USING btree (processed_month) WHERE (processed_month IS NOT NULL);


--
-- Name: idx_travel_allowances_processing_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_travel_allowances_processing_state ON public.travel_allowances USING btree (processing_state);


--
-- Name: idx_travel_allowances_requester; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_travel_allowances_requester ON public.travel_allowances USING btree (requester_email);


--
-- Name: idx_travel_allowances_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_travel_allowances_status ON public.travel_allowances USING btree (status);


--
-- Name: idx_travel_allowances_total_consolidated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_travel_allowances_total_consolidated ON public.travel_allowances USING btree (total_consolidated);


--
-- Name: idx_travel_allowances_visit_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_travel_allowances_visit_date ON public.travel_allowances USING btree (visit_date DESC);


--
-- Name: idx_travel_segments_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_travel_segments_user_date ON public.travel_segments USING btree (user_email, travel_date);


--
-- Name: idx_uar_correlation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uar_correlation_id ON public.user_attendance_records USING btree (correlation_id);


--
-- Name: idx_uar_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uar_request_id ON public.user_attendance_records USING btree (request_id);


--
-- Name: idx_uar_user_date_report; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uar_user_date_report ON public.user_attendance_records USING btree (user_id, date);


--
-- Name: idx_user_attendance_records_auto_closed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_attendance_records_auto_closed_at ON public.user_attendance_records USING btree (auto_closed_at);


--
-- Name: idx_user_attendance_records_auto_shift_end_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_attendance_records_auto_shift_end_at ON public.user_attendance_records USING btree (auto_shift_end_at);


--
-- Name: idx_user_certifications_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_certifications_active ON public.user_certifications USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_user_certifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_certifications_created_at ON public.user_certifications USING btree (created_at);


--
-- Name: idx_user_certifications_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_certifications_type ON public.user_certifications USING btree (credential_type);


--
-- Name: idx_user_certifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_certifications_user_id ON public.user_certifications USING btree (user_id);


--
-- Name: idx_user_gmail_tokens_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_gmail_tokens_email ON public.user_gmail_tokens USING btree (email);


--
-- Name: idx_user_gmail_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_gmail_tokens_user_id ON public.user_gmail_tokens USING btree (user_id);


--
-- Name: idx_user_module_access_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_module_access_user_id ON public.user_module_access USING btree (user_id);


--
-- Name: idx_user_profile_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profile_user_id ON public.user_profile USING btree (user_id);


--
-- Name: idx_users_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_active ON public.users USING btree (active);


--
-- Name: idx_vacaciones_firmas_signer_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vacaciones_firmas_signer_user ON public.vacaciones_solicitudes_firmas USING btree (signer_user_id, signed_at DESC);


--
-- Name: idx_vacaciones_firmas_solicitud_signed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vacaciones_firmas_solicitud_signed_at ON public.vacaciones_solicitudes_firmas USING btree (solicitud_id, signed_at DESC, id DESC);


--
-- Name: idx_vacaciones_saldos_historicos_anio_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vacaciones_saldos_historicos_anio_email ON public.vacaciones_saldos_historicos USING btree (anio, lower(user_email));


--
-- Name: idx_vacaciones_saldos_historicos_anio_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vacaciones_saldos_historicos_anio_user_id ON public.vacaciones_saldos_historicos USING btree (anio, user_id);


--
-- Name: idx_vacaciones_solicitudes_cancellation_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vacaciones_solicitudes_cancellation_status ON public.vacaciones_solicitudes USING btree (cancellation_status, updated_at DESC);


--
-- Name: idx_viatico_anticipos_allowance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_viatico_anticipos_allowance ON public.viatico_anticipos USING btree (allowance_id);


--
-- Name: idx_viatico_anticipos_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_viatico_anticipos_status ON public.viatico_anticipos USING btree (status);


--
-- Name: idx_visit_schedules_month_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visit_schedules_month_year ON public.visit_schedules USING btree (year, month, status);


--
-- Name: idx_visit_schedules_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visit_schedules_user_status ON public.visit_schedules USING btree (user_email, status);


--
-- Name: private_purchase_requests_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX private_purchase_requests_created_by_idx ON public.private_purchase_requests USING btree (created_by);


--
-- Name: private_purchase_requests_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX private_purchase_requests_status_idx ON public.private_purchase_requests USING btree (status);


--
-- Name: uidx_request_versions_req_ver; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uidx_request_versions_req_ver ON public.request_versions USING btree (request_id, version_number);


--
-- Name: uniq_bc_consumption_excluded_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_bc_consumption_excluded_key ON public.bc_consumption_excluded USING btree (business_case_id, item_key);


--
-- Name: uniq_bc_consumption_items_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_bc_consumption_items_key ON public.bc_consumption_items USING btree (business_case_id, item_key);


--
-- Name: uniq_bc_investment_selections; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_bc_investment_selections ON public.bc_investment_selections USING btree (business_case_id, catalog_id);


--
-- Name: uniq_equipment_part_per_model; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_equipment_part_per_model ON public.equipment_maintenance_parts USING btree (equipment_model_id, part_code, part_name);


--
-- Name: uq_attendance_idempotency_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_attendance_idempotency_active ON public.attendance_idempotency_keys USING btree (user_id, action_type, request_hash);


--
-- Name: uq_client_locations_single_main; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_client_locations_single_main ON public.client_locations USING btree (client_id) WHERE (is_main = true);


--
-- Name: uq_consumable_files_private_purchase; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_consumable_files_private_purchase ON public.consumable_files USING btree (private_purchase_request_id) WHERE (private_purchase_request_id IS NOT NULL);


--
-- Name: uq_consumable_files_public_purchase; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_consumable_files_public_purchase ON public.consumable_files USING btree (equipment_purchase_request_id) WHERE (equipment_purchase_request_id IS NOT NULL);


--
-- Name: uq_equipment_purchase_provider_contacts_email_norm; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_equipment_purchase_provider_contacts_email_norm ON public.equipment_purchase_provider_contacts USING btree (lower(TRIM(BOTH FROM email)));


--
-- Name: uq_travel_allowance_invoices_access_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_travel_allowance_invoices_access_key ON public.travel_allowance_invoices USING btree (access_key);


--
-- Name: uq_travel_allowances_visit_source; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_travel_allowances_visit_source ON public.travel_allowances USING btree (source_type, source_id) WHERE ((source_id IS NOT NULL) AND ((source_type)::text = ANY (ARRAY[('client_visit'::character varying)::text, ('prospect_visit'::character varying)::text])));


--
-- Name: ux_bc_det_docs_current_per_case; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_bc_det_docs_current_per_case ON public.bc_determinations_documents USING btree (business_case_id) WHERE (is_current = true);


--
-- Name: ux_catalog_determinations_eq_name_catcanon; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_catalog_determinations_eq_name_catcanon ON public.catalog_determinations USING btree (equipment_id, lower(btrim((name)::text)), (
CASE
    WHEN (lower(btrim((category)::text)) = ANY (ARRAY['reactivo'::text, 'determinacion'::text])) THEN 'reactivo_determinacion'::text
    ELSE lower(btrim((category)::text))
END));


--
-- Name: ux_client_requests_external_identity; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_client_requests_external_identity ON public.client_requests USING btree (external_source, external_id) WHERE ((external_source IS NOT NULL) AND (external_id IS NOT NULL));


--
-- Name: ux_delivery_ceiling_line_unique_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_delivery_ceiling_line_unique_reference ON public.delivery_ceiling_line USING btree (delivery_ceiling_id, item_type, COALESCE(equipment_model_id, 0), COALESCE(integration_product_map_id, (0)::bigint), COALESCE(odoo_product_id, 0), lower(unit));


--
-- Name: ux_delivery_ceiling_open_per_business_case; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_delivery_ceiling_open_per_business_case ON public.delivery_ceiling USING btree (business_case_id) WHERE (status = ANY (ARRAY['draft'::text, 'approved'::text, 'active'::text]));


--
-- Name: ux_delivery_request_line_unique_item; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_delivery_request_line_unique_item ON public.delivery_request_line USING btree (delivery_request_id, delivery_ceiling_line_id);


--
-- Name: ux_equipment_asset_schedule_asset_procedure_date; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_equipment_asset_schedule_asset_procedure_date ON public.equipment_asset_maintenance_schedule USING btree (asset_id, procedure_id, scheduled_for);


--
-- Name: ux_equipment_assets_serial_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_equipment_assets_serial_lower ON public.equipment_assets USING btree (lower(serial_number)) WHERE ((serial_number IS NOT NULL) AND (btrim(serial_number) <> ''::text));


--
-- Name: ux_integration_product_map_active_equipment_model; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_integration_product_map_active_equipment_model ON public.integration_product_map USING btree (spi_equipment_model_id) WHERE ((active = true) AND (spi_equipment_model_id IS NOT NULL));


--
-- Name: ux_integration_product_map_active_legacy_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_integration_product_map_active_legacy_code ON public.integration_product_map USING btree (lower(legacy_code)) WHERE ((active = true) AND (legacy_code IS NOT NULL));


--
-- Name: ux_integration_product_map_active_odoo_product; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_integration_product_map_active_odoo_product ON public.integration_product_map USING btree (odoo_product_id) WHERE ((active = true) AND (odoo_product_id IS NOT NULL));


--
-- Name: ux_integration_product_map_active_spi_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_integration_product_map_active_spi_sku ON public.integration_product_map USING btree (lower(spi_sku)) WHERE ((active = true) AND (spi_sku IS NOT NULL));


--
-- Name: ux_part_catalog_code_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_part_catalog_code_lower ON public.part_catalog USING btree (lower(code)) WHERE ((code IS NOT NULL) AND (btrim(code) <> ''::text));


--
-- Name: ux_permisos_firmas_current_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_permisos_firmas_current_stage ON public.permisos_vacaciones_firmas USING btree (solicitud_id, stage) WHERE (is_current = true);


--
-- Name: ux_permisos_legal_verification_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_permisos_legal_verification_token ON public.permisos_vacaciones USING btree (legal_verification_token) WHERE (legal_verification_token IS NOT NULL);


--
-- Name: ux_public_delivery_plan_line_unique_tranche; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_public_delivery_plan_line_unique_tranche ON public.public_delivery_plan_line USING btree (public_delivery_plan_id, delivery_ceiling_line_id, scheduled_start, scheduled_end);


--
-- Name: ux_public_delivery_plan_one_approved_per_ceiling; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_public_delivery_plan_one_approved_per_ceiling ON public.public_delivery_plan USING btree (delivery_ceiling_id) WHERE (status = 'approved'::text);


--
-- Name: ux_vacaciones_firmas_current_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_vacaciones_firmas_current_stage ON public.vacaciones_solicitudes_firmas USING btree (solicitud_id, stage) WHERE (is_current = true);


--
-- Name: ux_vacaciones_legal_verification_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_vacaciones_legal_verification_token ON public.vacaciones_solicitudes USING btree (legal_verification_token) WHERE (legal_verification_token IS NOT NULL);


--
-- Name: idx_corrective_case_comments_case; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_corrective_case_comments_case ON servicio.corrective_case_comments USING btree (case_id, created_at DESC);


--
-- Name: idx_corrective_case_events_case; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_corrective_case_events_case ON servicio.corrective_case_events USING btree (case_id, created_at DESC);


--
-- Name: idx_corrective_case_evidences_case; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_corrective_case_evidences_case ON servicio.corrective_case_evidences USING btree (case_id, created_at DESC);


--
-- Name: idx_corrective_cases_linked_source; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_corrective_cases_linked_source ON servicio.corrective_cases USING btree (linked_source_type, linked_source_id, updated_at DESC);


--
-- Name: idx_corrective_cases_requester; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_corrective_cases_requester ON servicio.corrective_cases USING btree (requester_user_id, created_at DESC);


--
-- Name: idx_corrective_cases_source; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_corrective_cases_source ON servicio.corrective_cases USING btree (source_type, source_id, created_at DESC);


--
-- Name: idx_corrective_cases_status; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_corrective_cases_status ON servicio.corrective_cases USING btree (status, priority, updated_at DESC);


--
-- Name: idx_corrective_spare_parts_case; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_corrective_spare_parts_case ON servicio.corrective_case_spare_parts USING btree (case_id, created_at DESC);


--
-- Name: idx_corrective_spare_parts_status; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_corrective_spare_parts_status ON servicio.corrective_case_spare_parts USING btree (quotation_status, client_decision, updated_at DESC);


--
-- Name: idx_cronograma_actividades_tecnicas_activity_date; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_cronograma_actividades_tecnicas_activity_date ON servicio.cronograma_actividades_tecnicas USING btree (activity_date, status);


--
-- Name: idx_cronograma_actividades_tecnicas_user_date; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_cronograma_actividades_tecnicas_user_date ON servicio.cronograma_actividades_tecnicas USING btree (user_id, activity_date);


--
-- Name: idx_cronograma_mantenimientos_next_status; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_cronograma_mantenimientos_next_status ON servicio.cronograma_mantenimientos USING btree (next_maintenance_status);


--
-- Name: idx_cronograma_mantenimientos_request_id; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_cronograma_mantenimientos_request_id ON servicio.cronograma_mantenimientos USING btree (request_id);


--
-- Name: idx_equipos_category; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_equipos_category ON servicio.equipos USING btree (category_type);


--
-- Name: idx_equipos_code; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_equipos_code ON servicio.equipos USING btree (code);


--
-- Name: idx_equipos_estado; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_equipos_estado ON servicio.equipos USING btree (estado);


--
-- Name: idx_external_case_events_case; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_external_case_events_case ON servicio.external_case_events USING btree (external_case_id, created_at DESC);


--
-- Name: idx_external_case_sync_jobs_case; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_external_case_sync_jobs_case ON servicio.external_case_sync_jobs USING btree (external_case_id, created_at DESC);


--
-- Name: idx_external_case_sync_jobs_queue; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_external_case_sync_jobs_queue ON servicio.external_case_sync_jobs USING btree (status, next_attempt_at, id);


--
-- Name: idx_external_cases_provider_status; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_external_cases_provider_status ON servicio.external_cases USING btree (provider, internal_status, updated_at DESC);


--
-- Name: idx_external_cases_search; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_external_cases_search ON servicio.external_cases USING btree (provider_case_reference, equipment_serial, client_name);


--
-- Name: idx_external_cases_sync_status; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_external_cases_sync_status ON servicio.external_cases USING btree (sync_retryable, next_sync_retry_at, updated_at DESC);


--
-- Name: idx_external_provider_identity_search; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_external_provider_identity_search ON servicio.external_provider_identities USING btree (provider, status, updated_at DESC);


--
-- Name: idx_mantenimientos_anuales_equipo; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_mantenimientos_anuales_equipo ON servicio.cronograma_mantenimientos_anuales USING btree (id_equipo);


--
-- Name: idx_mantenimientos_equipo; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_mantenimientos_equipo ON servicio.cronograma_mantenimientos USING btree (id_equipo);


--
-- Name: idx_mantenimientos_fecha; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_mantenimientos_fecha ON servicio.cronograma_mantenimientos USING btree (fecha_programada);


--
-- Name: idx_preventive_annual_plans_year; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_preventive_annual_plans_year ON servicio.preventive_annual_plans USING btree (plan_year, status, updated_at DESC);


--
-- Name: idx_preventive_case_events_plan_item; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_preventive_case_events_plan_item ON servicio.preventive_case_events USING btree (plan_item_id, created_at DESC);


--
-- Name: idx_preventive_documents_plan; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_preventive_documents_plan ON servicio.preventive_documents USING btree (annual_plan_id, document_code, created_at DESC);


--
-- Name: idx_preventive_documents_plan_item; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_preventive_documents_plan_item ON servicio.preventive_documents USING btree (plan_item_id, document_code, created_at DESC);


--
-- Name: idx_preventive_execution_reports_item; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_preventive_execution_reports_item ON servicio.preventive_execution_reports USING btree (plan_item_id, executed_at DESC);


--
-- Name: idx_preventive_kit_requests_item; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_preventive_kit_requests_item ON servicio.preventive_kit_requests USING btree (plan_item_id, requested_at DESC);


--
-- Name: idx_preventive_offers_item; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_preventive_offers_item ON servicio.preventive_offers USING btree (plan_item_id, issued_at DESC);


--
-- Name: idx_preventive_plan_items_plan; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_preventive_plan_items_plan ON servicio.preventive_plan_items USING btree (annual_plan_id, planned_month, planned_date);


--
-- Name: idx_preventive_plan_items_status; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_preventive_plan_items_status ON servicio.preventive_plan_items USING btree (status, planned_date);


--
-- Name: idx_preventive_reprogramming_item; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_preventive_reprogramming_item ON servicio.preventive_reprogramming_notices USING btree (plan_item_id, created_at DESC);


--
-- Name: idx_servicio_workflows_request; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_servicio_workflows_request ON servicio.workflows USING btree (request_id, updated_at DESC);


--
-- Name: idx_servicio_workflows_source; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_servicio_workflows_source ON servicio.workflows USING btree (source_type, source_id, updated_at DESC);


--
-- Name: idx_withdrawal_packaging_labels_workflow; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_withdrawal_packaging_labels_workflow ON servicio.withdrawal_packaging_labels USING btree (workflow_id, updated_at DESC);


--
-- Name: idx_withdrawal_workflows_request; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_withdrawal_workflows_request ON servicio.withdrawal_workflows USING btree (request_id, updated_at DESC);


--
-- Name: idx_withdrawal_workflows_status; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_withdrawal_workflows_status ON servicio.withdrawal_workflows USING btree (workflow_status, updated_at DESC);


--
-- Name: idx_workflow_audit_events_source; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_workflow_audit_events_source ON servicio.workflow_audit_events USING btree (source_type, source_id, created_at DESC);


--
-- Name: idx_workflow_documents_document_code; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_workflow_documents_document_code ON servicio.workflow_documents USING btree (document_code, created_at DESC);


--
-- Name: idx_workflow_documents_source; Type: INDEX; Schema: servicio; Owner: -
--

CREATE INDEX idx_workflow_documents_source ON servicio.workflow_documents USING btree (source_type, source_id, created_at DESC);


--
-- Name: uq_external_provider_identity; Type: INDEX; Schema: servicio; Owner: -
--

CREATE UNIQUE INDEX uq_external_provider_identity ON servicio.external_provider_identities USING btree (provider, client_user_identifier, COALESCE(equipment_serial, ''::text), COALESCE(area_name, ''::text), COALESCE(laboratory_name, ''::text));


--
-- Name: uq_workflow_documents_file; Type: INDEX; Schema: servicio; Owner: -
--

CREATE UNIQUE INDEX uq_workflow_documents_file ON servicio.workflow_documents USING btree (source_type, source_id, document_code, COALESCE(drive_file_id, ''::text));


--
-- Name: idx_wm_activity_log_project; Type: INDEX; Schema: work_management; Owner: -
--

CREATE INDEX idx_wm_activity_log_project ON work_management.work_activity_log USING btree (project_id, created_at DESC);


--
-- Name: idx_wm_boards_project; Type: INDEX; Schema: work_management; Owner: -
--

CREATE INDEX idx_wm_boards_project ON work_management.boards USING btree (project_id);


--
-- Name: idx_wm_groups_board; Type: INDEX; Schema: work_management; Owner: -
--

CREATE INDEX idx_wm_groups_board ON work_management.board_groups USING btree (board_id);


--
-- Name: idx_wm_item_assignees_user; Type: INDEX; Schema: work_management; Owner: -
--

CREATE INDEX idx_wm_item_assignees_user ON work_management.item_assignees USING btree (user_id);


--
-- Name: idx_wm_items_group; Type: INDEX; Schema: work_management; Owner: -
--

CREATE INDEX idx_wm_items_group ON work_management.items USING btree (group_id);


--
-- Name: idx_wm_items_group_sort; Type: INDEX; Schema: work_management; Owner: -
--

CREATE INDEX idx_wm_items_group_sort ON work_management.items USING btree (group_id, sort_order, created_at);


--
-- Name: idx_wm_items_project; Type: INDEX; Schema: work_management; Owner: -
--

CREATE INDEX idx_wm_items_project ON work_management.items USING btree (project_id);


--
-- Name: idx_wm_items_source; Type: INDEX; Schema: work_management; Owner: -
--

CREATE INDEX idx_wm_items_source ON work_management.items USING btree (source_module, source_entity_type, source_entity_id);


--
-- Name: idx_wm_project_members_user; Type: INDEX; Schema: work_management; Owner: -
--

CREATE INDEX idx_wm_project_members_user ON work_management.project_members USING btree (user_id) WHERE (is_active = true);


--
-- Name: idx_wm_projects_origin; Type: INDEX; Schema: work_management; Owner: -
--

CREATE INDEX idx_wm_projects_origin ON work_management.projects USING btree (origin_module, origin_entity_type, origin_entity_id);


--
-- Name: idx_wm_projects_owner; Type: INDEX; Schema: work_management; Owner: -
--

CREATE INDEX idx_wm_projects_owner ON work_management.projects USING btree (owner_user_id) WHERE (is_archived = false);


--
-- Name: idx_wm_projects_workspace; Type: INDEX; Schema: work_management; Owner: -
--

CREATE INDEX idx_wm_projects_workspace ON work_management.projects USING btree (workspace_id) WHERE (is_archived = false);


--
-- Name: idx_wm_spi_links_source; Type: INDEX; Schema: work_management; Owner: -
--

CREATE INDEX idx_wm_spi_links_source ON work_management.spi_links USING btree (source_module, source_entity_type, source_entity_id);


--
-- Name: idx_wm_workspace_members_user; Type: INDEX; Schema: work_management; Owner: -
--

CREATE INDEX idx_wm_workspace_members_user ON work_management.workspace_members USING btree (user_id) WHERE (is_active = true);


--
-- Name: idx_wm_workspace_owner; Type: INDEX; Schema: work_management; Owner: -
--

CREATE INDEX idx_wm_workspace_owner ON work_management.workspaces USING btree (owner_user_id) WHERE (is_archived = false);


--
-- Name: bc_determinations bc_determinations_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bc_determinations_audit AFTER INSERT OR DELETE OR UPDATE ON public.bc_determinations FOR EACH ROW EXECUTE FUNCTION public.bc_audit_trigger();


--
-- Name: bc_equipment_selection bc_equipment_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bc_equipment_audit AFTER INSERT OR DELETE OR UPDATE ON public.bc_equipment_selection FOR EACH ROW EXECUTE FUNCTION public.bc_audit_trigger();


--
-- Name: purchase_delivery_schedules purchase_delivery_schedules_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER purchase_delivery_schedules_updated_at_trigger BEFORE UPDATE ON public.purchase_delivery_schedules FOR EACH ROW EXECUTE FUNCTION public.update_purchase_delivery_schedules_updated_at();


--
-- Name: bc_determinations recalculate_on_determination_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER recalculate_on_determination_change AFTER INSERT OR DELETE OR UPDATE ON public.bc_determinations FOR EACH ROW EXECUTE FUNCTION public.trigger_mark_for_recalculation();


--
-- Name: bc_economic_data recalculate_on_economic_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER recalculate_on_economic_change AFTER UPDATE ON public.bc_economic_data FOR EACH ROW EXECUTE FUNCTION public.trigger_mark_for_recalculation();


--
-- Name: bc_investments recalculate_on_investment_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER recalculate_on_investment_change AFTER INSERT OR DELETE OR UPDATE ON public.bc_investments FOR EACH ROW EXECUTE FUNCTION public.trigger_mark_for_recalculation();


--
-- Name: bc_operational_data recalculate_on_operational_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER recalculate_on_operational_change AFTER UPDATE ON public.bc_operational_data FOR EACH ROW EXECUTE FUNCTION public.trigger_mark_for_recalculation();


--
-- Name: bc_master set_bc_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_bc_number BEFORE INSERT ON public.bc_master FOR EACH ROW EXECUTE FUNCTION public.generate_bc_number();


--
-- Name: technical_documents tech_docs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tech_docs_updated_at BEFORE UPDATE ON public.technical_documents FOR EACH ROW EXECUTE FUNCTION public.update_tech_docs_timestamp();


--
-- Name: accounts trg_accounts_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_accounts_touch_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.bs_touch_updated_at();


--
-- Name: user_attendance_records trg_attendance_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_attendance_updated_at BEFORE UPDATE ON public.user_attendance_records FOR EACH ROW EXECUTE FUNCTION public.update_attendance_timestamp();


--
-- Name: bs_action_item trg_bs_action_item_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bs_action_item_touch_updated_at BEFORE UPDATE ON public.bs_action_item FOR EACH ROW EXECUTE FUNCTION public.bs_touch_updated_at();


--
-- Name: bs_comment trg_bs_comment_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bs_comment_touch_updated_at BEFORE UPDATE ON public.bs_comment FOR EACH ROW EXECUTE FUNCTION public.bs_touch_updated_at();


--
-- Name: buying_influence trg_buying_influence_euphoria_red_flag; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_buying_influence_euphoria_red_flag AFTER INSERT OR UPDATE OF euphoria_panic ON public.buying_influence FOR EACH ROW EXECUTE FUNCTION public.bs_handle_euphoria_red_flag();


--
-- Name: buying_influence trg_buying_influence_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_buying_influence_touch_updated_at BEFORE UPDATE ON public.buying_influence FOR EACH ROW EXECUTE FUNCTION public.bs_touch_updated_at();


--
-- Name: ca0104_inspections trg_ca0104_inspections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ca0104_inspections_updated_at BEFORE UPDATE ON public.ca0104_inspections FOR EACH ROW EXECUTE FUNCTION public.ca0104_touch_updated_at();


--
-- Name: ca0104_toxicity trg_ca0104_toxicity_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ca0104_toxicity_updated_at BEFORE UPDATE ON public.ca0104_toxicity FOR EACH ROW EXECUTE FUNCTION public.ca0104_touch_updated_at();


--
-- Name: ca0104_traps_map trg_ca0104_traps_map_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ca0104_traps_map_updated_at BEFORE UPDATE ON public.ca0104_traps_map FOR EACH ROW EXECUTE FUNCTION public.ca0104_touch_updated_at();


--
-- Name: ca0104_vendor_api trg_ca0104_vendor_api_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ca0104_vendor_api_updated_at BEFORE UPDATE ON public.ca0104_vendor_api FOR EACH ROW EXECUTE FUNCTION public.ca0104_touch_updated_at();


--
-- Name: competitor trg_competitor_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_competitor_touch_updated_at BEFORE UPDATE ON public.competitor FOR EACH ROW EXECUTE FUNCTION public.bs_touch_updated_at();


--
-- Name: contacts trg_contacts_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_contacts_touch_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.bs_touch_updated_at();


--
-- Name: documents trg_documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: document_hashes trg_ensure_single_current_hash; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ensure_single_current_hash BEFORE INSERT OR UPDATE ON public.document_hashes FOR EACH ROW EXECUTE FUNCTION public.ensure_single_current_hash();


--
-- Name: equipos trg_equipos_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_equipos_touch BEFORE UPDATE ON public.equipos FOR EACH ROW EXECUTE FUNCTION public.equipos_touch_updated_at();


--
-- Name: equipos_unidad trg_equipos_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_equipos_touch BEFORE UPDATE ON public.equipos_unidad FOR EACH ROW EXECUTE FUNCTION public.equipos_touch();


--
-- Name: personnel_requests trg_generate_personnel_request_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_generate_personnel_request_number BEFORE INSERT ON public.personnel_requests FOR EACH ROW EXECUTE FUNCTION public.generate_personnel_request_number();


--
-- Name: document_qr_codes trg_generate_qr_url; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_generate_qr_url BEFORE INSERT ON public.document_qr_codes FOR EACH ROW EXECUTE FUNCTION public.generate_qr_url_trigger();


--
-- Name: document_seals trg_generate_seal_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_generate_seal_code BEFORE INSERT ON public.document_seals FOR EACH ROW EXECUTE FUNCTION public.generate_seal_code_trigger();


--
-- Name: inventory_movements trg_inventory_after_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_inventory_after_delete AFTER DELETE ON public.inventory_movements FOR EACH ROW EXECUTE FUNCTION public.recalculate_inventory();


--
-- Name: inventory_movements trg_inventory_after_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_inventory_after_insert AFTER INSERT ON public.inventory_movements FOR EACH ROW EXECUTE FUNCTION public.recalculate_inventory();


--
-- Name: inventory_movements trg_inventory_after_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_inventory_after_update AFTER UPDATE ON public.inventory_movements FOR EACH ROW EXECUTE FUNCTION public.recalculate_inventory();


--
-- Name: personnel_requests trg_log_personnel_request_status_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_log_personnel_request_status_change AFTER UPDATE ON public.personnel_requests FOR EACH ROW EXECUTE FUNCTION public.log_personnel_request_status_change();


--
-- Name: requests trg_log_request_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_log_request_status AFTER UPDATE OF status ON public.requests FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION public.fn_log_request_status();


--
-- Name: opportunity_flag trg_opportunity_flag_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_opportunity_flag_touch_updated_at BEFORE UPDATE ON public.opportunity_flag FOR EACH ROW EXECUTE FUNCTION public.bs_touch_updated_at();


--
-- Name: opportunity_process_link trg_opportunity_process_link_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_opportunity_process_link_touch_updated_at BEFORE UPDATE ON public.opportunity_process_link FOR EACH ROW EXECUTE FUNCTION public.bs_touch_updated_at();


--
-- Name: opportunity_rating trg_opportunity_rating_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_opportunity_rating_touch_updated_at BEFORE UPDATE ON public.opportunity_rating FOR EACH ROW EXECUTE FUNCTION public.bs_touch_updated_at();


--
-- Name: opportunity trg_opportunity_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_opportunity_touch_updated_at BEFORE UPDATE ON public.opportunity FOR EACH ROW EXECUTE FUNCTION public.bs_touch_updated_at();


--
-- Name: request_types trg_request_types_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_request_types_updated_at BEFORE UPDATE ON public.request_types FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: requests trg_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_requests_updated_at BEFORE UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: ti_assets trg_ti_asset_status_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ti_asset_status_change AFTER UPDATE ON public.ti_assets FOR EACH ROW EXECUTE FUNCTION public.audit_ti_asset_status_change();


--
-- Name: document_signatures_advanced trg_update_document_signature_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_document_signature_status AFTER INSERT OR DELETE OR UPDATE ON public.document_signatures_advanced FOR EACH ROW EXECUTE FUNCTION public.update_document_signature_status();


--
-- Name: personnel_requests trg_update_personnel_request_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_personnel_request_timestamp BEFORE UPDATE ON public.personnel_requests FOR EACH ROW EXECUTE FUNCTION public.update_personnel_request_timestamp();


--
-- Name: contract_determinations trg_update_remaining_quantity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_remaining_quantity BEFORE INSERT OR UPDATE OF consumed_quantity, annual_negotiated_quantity ON public.contract_determinations FOR EACH ROW EXECUTE FUNCTION public.update_remaining_quantity();


--
-- Name: users trg_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: user_certifications trigger_user_certifications_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_user_certifications_updated_at BEFORE UPDATE ON public.user_certifications FOR EACH ROW EXECUTE FUNCTION public.update_user_certifications_updated_at();


--
-- Name: calculation_templates update_calc_templates_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_calc_templates_timestamp BEFORE UPDATE ON public.calculation_templates FOR EACH ROW EXECUTE FUNCTION public.update_calculation_templates_timestamp();


--
-- Name: employee_contracts update_employee_contracts_timestamp_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_employee_contracts_timestamp_trigger BEFORE UPDATE ON public.employee_contracts FOR EACH ROW EXECUTE FUNCTION public.update_employee_contracts_timestamp();


--
-- Name: cronograma_capacitacion capacitacion_update_timestamp; Type: TRIGGER; Schema: servicio; Owner: -
--

CREATE TRIGGER capacitacion_update_timestamp BEFORE UPDATE ON servicio.cronograma_capacitacion FOR EACH ROW EXECUTE FUNCTION servicio.update_timestamp();


--
-- Name: equipos equipos_update_timestamp; Type: TRIGGER; Schema: servicio; Owner: -
--

CREATE TRIGGER equipos_update_timestamp BEFORE UPDATE ON servicio.equipos FOR EACH ROW EXECUTE FUNCTION servicio.update_timestamp();


--
-- Name: cronograma_mantenimientos_anuales mantenimiento_anual_update_timestamp; Type: TRIGGER; Schema: servicio; Owner: -
--

CREATE TRIGGER mantenimiento_anual_update_timestamp BEFORE UPDATE ON servicio.cronograma_mantenimientos_anuales FOR EACH ROW EXECUTE FUNCTION servicio.update_timestamp();


--
-- Name: cronograma_mantenimientos mantenimiento_update_timestamp; Type: TRIGGER; Schema: servicio; Owner: -
--

CREATE TRIGGER mantenimiento_update_timestamp BEFORE UPDATE ON servicio.cronograma_mantenimientos FOR EACH ROW EXECUTE FUNCTION servicio.update_timestamp();


--
-- Name: cronograma_capacitacion trg_capacitacion_updated_at; Type: TRIGGER; Schema: servicio; Owner: -
--

CREATE TRIGGER trg_capacitacion_updated_at BEFORE UPDATE ON servicio.cronograma_capacitacion FOR EACH ROW EXECUTE FUNCTION servicio.update_timestamp();


--
-- Name: disponibilidad_tecnicos trg_disponibilidad_updated_at; Type: TRIGGER; Schema: servicio; Owner: -
--

CREATE TRIGGER trg_disponibilidad_updated_at BEFORE UPDATE ON servicio.disponibilidad_tecnicos FOR EACH ROW EXECUTE FUNCTION servicio.update_timestamp();


--
-- Name: cronograma_mantenimientos_anuales trg_mantenimientos_anuales_updated_at; Type: TRIGGER; Schema: servicio; Owner: -
--

CREATE TRIGGER trg_mantenimientos_anuales_updated_at BEFORE UPDATE ON servicio.cronograma_mantenimientos_anuales FOR EACH ROW EXECUTE FUNCTION servicio.update_timestamp();


--
-- Name: cronograma_mantenimientos trg_mantenimientos_updated_at; Type: TRIGGER; Schema: servicio; Owner: -
--

CREATE TRIGGER trg_mantenimientos_updated_at BEFORE UPDATE ON servicio.cronograma_mantenimientos FOR EACH ROW EXECUTE FUNCTION servicio.update_timestamp();


--
-- Name: crm_accounts crm_accounts_created_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_accounts
    ADD CONSTRAINT crm_accounts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: crm_accounts crm_accounts_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_accounts
    ADD CONSTRAINT crm_accounts_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id);


--
-- Name: crm_accounts crm_accounts_updated_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_accounts
    ADD CONSTRAINT crm_accounts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: crm_action_items crm_action_items_blue_sheet_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_action_items
    ADD CONSTRAINT crm_action_items_blue_sheet_id_fkey FOREIGN KEY (blue_sheet_id) REFERENCES crm.crm_blue_sheets(id);


--
-- Name: crm_action_items crm_action_items_created_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_action_items
    ADD CONSTRAINT crm_action_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: crm_action_items crm_action_items_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_action_items
    ADD CONSTRAINT crm_action_items_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES crm.crm_opportunities(id);


--
-- Name: crm_action_items crm_action_items_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_action_items
    ADD CONSTRAINT crm_action_items_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id);


--
-- Name: crm_action_items crm_action_items_updated_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_action_items
    ADD CONSTRAINT crm_action_items_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: crm_activities crm_activities_account_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_activities
    ADD CONSTRAINT crm_activities_account_id_fkey FOREIGN KEY (account_id) REFERENCES crm.crm_accounts(id);


--
-- Name: crm_activities crm_activities_blue_sheet_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_activities
    ADD CONSTRAINT crm_activities_blue_sheet_id_fkey FOREIGN KEY (blue_sheet_id) REFERENCES crm.crm_blue_sheets(id);


--
-- Name: crm_activities crm_activities_contact_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_activities
    ADD CONSTRAINT crm_activities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES crm.crm_contacts(id);


--
-- Name: crm_activities crm_activities_created_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_activities
    ADD CONSTRAINT crm_activities_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: crm_activities crm_activities_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_activities
    ADD CONSTRAINT crm_activities_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES crm.crm_opportunities(id);


--
-- Name: crm_activities crm_activities_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_activities
    ADD CONSTRAINT crm_activities_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id);


--
-- Name: crm_activities crm_activities_updated_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_activities
    ADD CONSTRAINT crm_activities_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: crm_audit_log crm_audit_log_performed_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_audit_log
    ADD CONSTRAINT crm_audit_log_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: crm_blue_sheet_versions crm_blue_sheet_versions_blue_sheet_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_blue_sheet_versions
    ADD CONSTRAINT crm_blue_sheet_versions_blue_sheet_id_fkey FOREIGN KEY (blue_sheet_id) REFERENCES crm.crm_blue_sheets(id);


--
-- Name: crm_blue_sheet_versions crm_blue_sheet_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_blue_sheet_versions
    ADD CONSTRAINT crm_blue_sheet_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: crm_blue_sheets crm_blue_sheets_approved_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_blue_sheets
    ADD CONSTRAINT crm_blue_sheets_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: crm_blue_sheets crm_blue_sheets_created_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_blue_sheets
    ADD CONSTRAINT crm_blue_sheets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: crm_blue_sheets crm_blue_sheets_observed_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_blue_sheets
    ADD CONSTRAINT crm_blue_sheets_observed_by_fkey FOREIGN KEY (observed_by) REFERENCES public.users(id);


--
-- Name: crm_blue_sheets crm_blue_sheets_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_blue_sheets
    ADD CONSTRAINT crm_blue_sheets_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES crm.crm_opportunities(id);


--
-- Name: crm_blue_sheets crm_blue_sheets_reopened_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_blue_sheets
    ADD CONSTRAINT crm_blue_sheets_reopened_by_fkey FOREIGN KEY (reopened_by) REFERENCES public.users(id);


--
-- Name: crm_blue_sheets crm_blue_sheets_submitted_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_blue_sheets
    ADD CONSTRAINT crm_blue_sheets_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: crm_blue_sheets crm_blue_sheets_updated_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_blue_sheets
    ADD CONSTRAINT crm_blue_sheets_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: crm_buying_influences crm_buying_influences_blue_sheet_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_buying_influences
    ADD CONSTRAINT crm_buying_influences_blue_sheet_id_fkey FOREIGN KEY (blue_sheet_id) REFERENCES crm.crm_blue_sheets(id);


--
-- Name: crm_buying_influences crm_buying_influences_contact_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_buying_influences
    ADD CONSTRAINT crm_buying_influences_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES crm.crm_contacts(id);


--
-- Name: crm_buying_influences crm_buying_influences_created_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_buying_influences
    ADD CONSTRAINT crm_buying_influences_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: crm_buying_influences crm_buying_influences_updated_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_buying_influences
    ADD CONSTRAINT crm_buying_influences_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: crm_competitive_preferences crm_competitive_preferences_blue_sheet_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_competitive_preferences
    ADD CONSTRAINT crm_competitive_preferences_blue_sheet_id_fkey FOREIGN KEY (blue_sheet_id) REFERENCES crm.crm_blue_sheets(id);


--
-- Name: crm_competitive_preferences crm_competitive_preferences_buying_influence_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_competitive_preferences
    ADD CONSTRAINT crm_competitive_preferences_buying_influence_id_fkey FOREIGN KEY (buying_influence_id) REFERENCES crm.crm_buying_influences(id);


--
-- Name: crm_competitive_preferences crm_competitive_preferences_competitor_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_competitive_preferences
    ADD CONSTRAINT crm_competitive_preferences_competitor_id_fkey FOREIGN KEY (competitor_id) REFERENCES crm.crm_competitors(id);


--
-- Name: crm_competitive_preferences crm_competitive_preferences_created_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_competitive_preferences
    ADD CONSTRAINT crm_competitive_preferences_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: crm_competitors crm_competitors_blue_sheet_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_competitors
    ADD CONSTRAINT crm_competitors_blue_sheet_id_fkey FOREIGN KEY (blue_sheet_id) REFERENCES crm.crm_blue_sheets(id);


--
-- Name: crm_competitors crm_competitors_created_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_competitors
    ADD CONSTRAINT crm_competitors_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: crm_contacts crm_contacts_account_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_contacts
    ADD CONSTRAINT crm_contacts_account_id_fkey FOREIGN KEY (account_id) REFERENCES crm.crm_accounts(id);


--
-- Name: crm_contacts crm_contacts_created_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_contacts
    ADD CONSTRAINT crm_contacts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: crm_contacts crm_contacts_updated_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_contacts
    ADD CONSTRAINT crm_contacts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: crm_documents crm_documents_account_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_documents
    ADD CONSTRAINT crm_documents_account_id_fkey FOREIGN KEY (account_id) REFERENCES crm.crm_accounts(id);


--
-- Name: crm_documents crm_documents_blue_sheet_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_documents
    ADD CONSTRAINT crm_documents_blue_sheet_id_fkey FOREIGN KEY (blue_sheet_id) REFERENCES crm.crm_blue_sheets(id);


--
-- Name: crm_documents crm_documents_created_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_documents
    ADD CONSTRAINT crm_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: crm_documents crm_documents_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_documents
    ADD CONSTRAINT crm_documents_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES crm.crm_opportunities(id);


--
-- Name: crm_leads crm_leads_converted_account_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_leads
    ADD CONSTRAINT crm_leads_converted_account_id_fkey FOREIGN KEY (converted_account_id) REFERENCES crm.crm_accounts(id);


--
-- Name: crm_leads crm_leads_converted_contact_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_leads
    ADD CONSTRAINT crm_leads_converted_contact_id_fkey FOREIGN KEY (converted_contact_id) REFERENCES crm.crm_contacts(id);


--
-- Name: crm_leads crm_leads_created_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_leads
    ADD CONSTRAINT crm_leads_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: crm_leads crm_leads_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_leads
    ADD CONSTRAINT crm_leads_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id);


--
-- Name: crm_leads crm_leads_updated_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_leads
    ADD CONSTRAINT crm_leads_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: crm_notes crm_notes_account_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_notes
    ADD CONSTRAINT crm_notes_account_id_fkey FOREIGN KEY (account_id) REFERENCES crm.crm_accounts(id);


--
-- Name: crm_notes crm_notes_blue_sheet_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_notes
    ADD CONSTRAINT crm_notes_blue_sheet_id_fkey FOREIGN KEY (blue_sheet_id) REFERENCES crm.crm_blue_sheets(id);


--
-- Name: crm_notes crm_notes_contact_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_notes
    ADD CONSTRAINT crm_notes_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES crm.crm_contacts(id);


--
-- Name: crm_notes crm_notes_created_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_notes
    ADD CONSTRAINT crm_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: crm_notes crm_notes_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_notes
    ADD CONSTRAINT crm_notes_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES crm.crm_opportunities(id);


--
-- Name: crm_notes crm_notes_updated_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_notes
    ADD CONSTRAINT crm_notes_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: crm_opportunities crm_opportunities_account_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_opportunities
    ADD CONSTRAINT crm_opportunities_account_id_fkey FOREIGN KEY (account_id) REFERENCES crm.crm_accounts(id);


--
-- Name: crm_opportunities crm_opportunities_assigned_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_opportunities
    ADD CONSTRAINT crm_opportunities_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: crm_opportunities crm_opportunities_created_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_opportunities
    ADD CONSTRAINT crm_opportunities_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: crm_opportunities crm_opportunities_lead_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_opportunities
    ADD CONSTRAINT crm_opportunities_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES crm.crm_leads(id);


--
-- Name: crm_opportunities crm_opportunities_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_opportunities
    ADD CONSTRAINT crm_opportunities_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id);


--
-- Name: crm_opportunities crm_opportunities_primary_contact_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_opportunities
    ADD CONSTRAINT crm_opportunities_primary_contact_id_fkey FOREIGN KEY (primary_contact_id) REFERENCES crm.crm_contacts(id);


--
-- Name: crm_opportunities crm_opportunities_stage_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_opportunities
    ADD CONSTRAINT crm_opportunities_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES crm.crm_pipeline_stages(id);


--
-- Name: crm_opportunities crm_opportunities_updated_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_opportunities
    ADD CONSTRAINT crm_opportunities_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: crm_opportunity_products crm_opportunity_products_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_opportunity_products
    ADD CONSTRAINT crm_opportunity_products_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES crm.crm_opportunities(id) ON DELETE CASCADE;


--
-- Name: crm_red_flags crm_red_flags_accepted_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_red_flags
    ADD CONSTRAINT crm_red_flags_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES public.users(id);


--
-- Name: crm_red_flags crm_red_flags_blue_sheet_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_red_flags
    ADD CONSTRAINT crm_red_flags_blue_sheet_id_fkey FOREIGN KEY (blue_sheet_id) REFERENCES crm.crm_blue_sheets(id);


--
-- Name: crm_red_flags crm_red_flags_created_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_red_flags
    ADD CONSTRAINT crm_red_flags_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: crm_red_flags crm_red_flags_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_red_flags
    ADD CONSTRAINT crm_red_flags_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id);


--
-- Name: crm_review_comments crm_review_comments_blue_sheet_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_review_comments
    ADD CONSTRAINT crm_review_comments_blue_sheet_id_fkey FOREIGN KEY (blue_sheet_id) REFERENCES crm.crm_blue_sheets(id);


--
-- Name: crm_review_comments crm_review_comments_created_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_review_comments
    ADD CONSTRAINT crm_review_comments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: crm_review_comments crm_review_comments_resolved_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_review_comments
    ADD CONSTRAINT crm_review_comments_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: crm_scorecard_answers crm_scorecard_answers_blue_sheet_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_scorecard_answers
    ADD CONSTRAINT crm_scorecard_answers_blue_sheet_id_fkey FOREIGN KEY (blue_sheet_id) REFERENCES crm.crm_blue_sheets(id);


--
-- Name: crm_scorecard_answers crm_scorecard_answers_criterion_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_scorecard_answers
    ADD CONSTRAINT crm_scorecard_answers_criterion_id_fkey FOREIGN KEY (criterion_id) REFERENCES crm.crm_scorecard_criteria(id);


--
-- Name: crm_scorecard_answers crm_scorecard_answers_updated_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_scorecard_answers
    ADD CONSTRAINT crm_scorecard_answers_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: crm_strengths crm_strengths_blue_sheet_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_strengths
    ADD CONSTRAINT crm_strengths_blue_sheet_id_fkey FOREIGN KEY (blue_sheet_id) REFERENCES crm.crm_blue_sheets(id);


--
-- Name: crm_strengths crm_strengths_created_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_strengths
    ADD CONSTRAINT crm_strengths_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: crm_win_results crm_win_results_blue_sheet_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_win_results
    ADD CONSTRAINT crm_win_results_blue_sheet_id_fkey FOREIGN KEY (blue_sheet_id) REFERENCES crm.crm_blue_sheets(id);


--
-- Name: crm_win_results crm_win_results_buying_influence_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_win_results
    ADD CONSTRAINT crm_win_results_buying_influence_id_fkey FOREIGN KEY (buying_influence_id) REFERENCES crm.crm_buying_influences(id);


--
-- Name: crm_win_results crm_win_results_created_by_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.crm_win_results
    ADD CONSTRAINT crm_win_results_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: accounts accounts_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: accounts accounts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: accounts accounts_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: advisor_location_history advisor_location_history_client_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.advisor_location_history
    ADD CONSTRAINT advisor_location_history_client_request_id_fkey FOREIGN KEY (client_request_id) REFERENCES public.client_requests(id) ON DELETE SET NULL;


--
-- Name: advisor_location_history advisor_location_history_visit_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.advisor_location_history
    ADD CONSTRAINT advisor_location_history_visit_log_id_fkey FOREIGN KEY (visit_log_id) REFERENCES public.client_visit_logs(id) ON DELETE SET NULL;


--
-- Name: applicant_documents applicant_documents_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_documents
    ADD CONSTRAINT applicant_documents_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.applicants(id) ON DELETE CASCADE;


--
-- Name: applicant_education applicant_education_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_education
    ADD CONSTRAINT applicant_education_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.applicants(id) ON DELETE CASCADE;


--
-- Name: applicant_ethnic_id applicant_ethnic_id_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_ethnic_id
    ADD CONSTRAINT applicant_ethnic_id_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.applicants(id) ON DELETE CASCADE;


--
-- Name: applicant_health applicant_health_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_health
    ADD CONSTRAINT applicant_health_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.applicants(id) ON DELETE CASCADE;


--
-- Name: applicant_licenses applicant_licenses_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_licenses
    ADD CONSTRAINT applicant_licenses_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.applicants(id) ON DELETE CASCADE;


--
-- Name: applicant_personal_data applicant_personal_data_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_personal_data
    ADD CONSTRAINT applicant_personal_data_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.applicants(id) ON DELETE CASCADE;


--
-- Name: applicant_personal_references applicant_personal_references_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_personal_references
    ADD CONSTRAINT applicant_personal_references_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.applicants(id) ON DELETE CASCADE;


--
-- Name: applicant_pipeline_entries applicant_pipeline_entries_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_pipeline_entries
    ADD CONSTRAINT applicant_pipeline_entries_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.applicants(id) ON DELETE CASCADE;


--
-- Name: applicant_pipeline_entries applicant_pipeline_entries_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_pipeline_entries
    ADD CONSTRAINT applicant_pipeline_entries_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.personnel_requests(id) ON DELETE CASCADE;


--
-- Name: applicant_pipeline_entries applicant_pipeline_entries_started_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_pipeline_entries
    ADD CONSTRAINT applicant_pipeline_entries_started_by_fkey FOREIGN KEY (started_by) REFERENCES public.users(id);


--
-- Name: applicant_stage_results applicant_stage_results_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_stage_results
    ADD CONSTRAINT applicant_stage_results_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id);


--
-- Name: applicant_stage_results applicant_stage_results_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_stage_results
    ADD CONSTRAINT applicant_stage_results_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.applicant_pipeline_entries(id) ON DELETE CASCADE;


--
-- Name: applicant_trainings applicant_trainings_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_trainings
    ADD CONSTRAINT applicant_trainings_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.applicants(id) ON DELETE CASCADE;


--
-- Name: applicant_work_experience applicant_work_experience_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_work_experience
    ADD CONSTRAINT applicant_work_experience_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.applicants(id) ON DELETE CASCADE;


--
-- Name: applicant_work_references applicant_work_references_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_work_references
    ADD CONSTRAINT applicant_work_references_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.applicants(id) ON DELETE CASCADE;


--
-- Name: applicants applicants_personnel_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicants
    ADD CONSTRAINT applicants_personnel_request_id_fkey FOREIGN KEY (personnel_request_id) REFERENCES public.personnel_requests(id) ON DELETE SET NULL;


--
-- Name: attendance_audit_events attendance_audit_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_audit_events
    ADD CONSTRAINT attendance_audit_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attendance_audit_events attendance_audit_events_affected_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_audit_events
    ADD CONSTRAINT attendance_audit_events_affected_user_id_fkey FOREIGN KEY (affected_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attendance_birthday_day_off_benefits attendance_birthday_day_off_benefi_qr_generated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_birthday_day_off_benefits
    ADD CONSTRAINT attendance_birthday_day_off_benefi_qr_generated_by_user_id_fkey FOREIGN KEY (qr_generated_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attendance_birthday_day_off_benefits attendance_birthday_day_off_benefits_redeemed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_birthday_day_off_benefits
    ADD CONSTRAINT attendance_birthday_day_off_benefits_redeemed_by_user_id_fkey FOREIGN KEY (redeemed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attendance_birthday_day_off_benefits attendance_birthday_day_off_benefits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_birthday_day_off_benefits
    ADD CONSTRAINT attendance_birthday_day_off_benefits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: attendance_exceptions attendance_exceptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_exceptions
    ADD CONSTRAINT attendance_exceptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: attendance_idempotency_keys attendance_idempotency_keys_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_idempotency_keys
    ADD CONSTRAINT attendance_idempotency_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: attendance_late_justifications attendance_late_justifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_late_justifications
    ADD CONSTRAINT attendance_late_justifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: attendance_overtime attendance_overtime_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_overtime
    ADD CONSTRAINT attendance_overtime_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: attendance_pdf_versions attendance_pdf_versions_generated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_pdf_versions
    ADD CONSTRAINT attendance_pdf_versions_generated_by_user_id_fkey FOREIGN KEY (generated_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attendance_pdf_versions attendance_pdf_versions_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_pdf_versions
    ADD CONSTRAINT attendance_pdf_versions_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.attendance_periods(id) ON DELETE SET NULL;


--
-- Name: attendance_pdf_versions attendance_pdf_versions_previous_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_pdf_versions
    ADD CONSTRAINT attendance_pdf_versions_previous_version_id_fkey FOREIGN KEY (previous_version_id) REFERENCES public.attendance_pdf_versions(id) ON DELETE SET NULL;


--
-- Name: attendance_pdf_versions attendance_pdf_versions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_pdf_versions
    ADD CONSTRAINT attendance_pdf_versions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: attendance_pending_locations attendance_pending_locations_rejected_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_pending_locations
    ADD CONSTRAINT attendance_pending_locations_rejected_by_user_id_fkey FOREIGN KEY (rejected_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attendance_pending_locations attendance_pending_locations_resolved_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_pending_locations
    ADD CONSTRAINT attendance_pending_locations_resolved_by_user_id_fkey FOREIGN KEY (resolved_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attendance_pending_locations attendance_pending_locations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_pending_locations
    ADD CONSTRAINT attendance_pending_locations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: attendance_period_events attendance_period_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_period_events
    ADD CONSTRAINT attendance_period_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attendance_period_events attendance_period_events_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_period_events
    ADD CONSTRAINT attendance_period_events_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.attendance_periods(id) ON DELETE CASCADE;


--
-- Name: attendance_periods attendance_periods_closed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_periods
    ADD CONSTRAINT attendance_periods_closed_by_user_id_fkey FOREIGN KEY (closed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attendance_periods attendance_periods_reopened_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_periods
    ADD CONSTRAINT attendance_periods_reopened_by_user_id_fkey FOREIGN KEY (reopened_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attendance_regularization_events attendance_regularization_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_regularization_events
    ADD CONSTRAINT attendance_regularization_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attendance_regularization_events attendance_regularization_events_regularization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_regularization_events
    ADD CONSTRAINT attendance_regularization_events_regularization_id_fkey FOREIGN KEY (regularization_id) REFERENCES public.attendance_regularizations(id) ON DELETE CASCADE;


--
-- Name: attendance_regularizations attendance_regularizations_affected_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_regularizations
    ADD CONSTRAINT attendance_regularizations_affected_user_id_fkey FOREIGN KEY (affected_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: attendance_regularizations attendance_regularizations_approver_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_regularizations
    ADD CONSTRAINT attendance_regularizations_approver_user_id_fkey FOREIGN KEY (approver_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attendance_regularizations attendance_regularizations_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_regularizations
    ADD CONSTRAINT attendance_regularizations_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.attendance_periods(id) ON DELETE SET NULL;


--
-- Name: attendance_regularizations attendance_regularizations_requester_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_regularizations
    ADD CONSTRAINT attendance_regularizations_requester_user_id_fkey FOREIGN KEY (requester_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: attendance_shortcut_tokens attendance_shortcut_tokens_issued_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_shortcut_tokens
    ADD CONSTRAINT attendance_shortcut_tokens_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.users(id);


--
-- Name: attendance_shortcut_tokens attendance_shortcut_tokens_revoked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_shortcut_tokens
    ADD CONSTRAINT attendance_shortcut_tokens_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES public.users(id);


--
-- Name: attendance_shortcut_tokens attendance_shortcut_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_shortcut_tokens
    ADD CONSTRAINT attendance_shortcut_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: audit_access_grants audit_access_grants_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_access_grants
    ADD CONSTRAINT audit_access_grants_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: audit_access_grants audit_access_grants_revoked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_access_grants
    ADD CONSTRAINT audit_access_grants_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES public.users(id);


--
-- Name: audit_documents audit_documents_section_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_documents
    ADD CONSTRAINT audit_documents_section_code_fkey FOREIGN KEY (section_code) REFERENCES public.audit_sections(code);


--
-- Name: audit_documents audit_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_documents
    ADD CONSTRAINT audit_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: bc_alerts bc_alerts_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_alerts
    ADD CONSTRAINT bc_alerts_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- Name: bc_alerts bc_alerts_contract_determination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_alerts
    ADD CONSTRAINT bc_alerts_contract_determination_id_fkey FOREIGN KEY (contract_determination_id) REFERENCES public.contract_determinations(id) ON DELETE SET NULL;


--
-- Name: bc_audit_log bc_audit_log_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_audit_log
    ADD CONSTRAINT bc_audit_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: bc_consumption_excluded bc_consumption_excluded_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_consumption_excluded
    ADD CONSTRAINT bc_consumption_excluded_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- Name: bc_consumption_items bc_consumption_items_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_consumption_items
    ADD CONSTRAINT bc_consumption_items_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- Name: bc_deliveries bc_deliveries_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_deliveries
    ADD CONSTRAINT bc_deliveries_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- Name: bc_determinations bc_determinations_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_determinations
    ADD CONSTRAINT bc_determinations_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id);


--
-- Name: bc_determinations bc_determinations_bc_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_determinations
    ADD CONSTRAINT bc_determinations_bc_master_id_fkey FOREIGN KEY (bc_master_id) REFERENCES public.bc_master(id) ON DELETE CASCADE;


--
-- Name: bc_determinations bc_determinations_determination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_determinations
    ADD CONSTRAINT bc_determinations_determination_id_fkey FOREIGN KEY (determination_id) REFERENCES public.catalog_determinations(id) ON DELETE CASCADE;


--
-- Name: bc_determinations_documents bc_determinations_documents_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_determinations_documents
    ADD CONSTRAINT bc_determinations_documents_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- Name: bc_determinations_documents bc_determinations_documents_uploaded_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_determinations_documents
    ADD CONSTRAINT bc_determinations_documents_uploaded_by_user_id_fkey FOREIGN KEY (uploaded_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bc_dispatch_items bc_dispatch_items_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_dispatch_items
    ADD CONSTRAINT bc_dispatch_items_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- Name: bc_economic_data bc_economic_data_bc_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_economic_data
    ADD CONSTRAINT bc_economic_data_bc_master_id_fkey FOREIGN KEY (bc_master_id) REFERENCES public.bc_master(id) ON DELETE CASCADE;


--
-- Name: bc_equipment_details bc_equipment_details_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_equipment_details
    ADD CONSTRAINT bc_equipment_details_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- Name: bc_equipment_selection bc_equipment_selection_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_equipment_selection
    ADD CONSTRAINT bc_equipment_selection_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES servicio.equipos(id_equipo) ON DELETE CASCADE;


--
-- Name: bc_inventory_reservations bc_inventory_reservations_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_inventory_reservations
    ADD CONSTRAINT bc_inventory_reservations_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- Name: bc_investment_selection_requests bc_investment_selection_requests_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_investment_selection_requests
    ADD CONSTRAINT bc_investment_selection_requests_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- Name: bc_investment_selection_requests bc_investment_selection_requests_catalog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_investment_selection_requests
    ADD CONSTRAINT bc_investment_selection_requests_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES public.bc_investment_catalog(id) ON DELETE CASCADE;


--
-- Name: bc_investment_selections bc_investment_selections_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_investment_selections
    ADD CONSTRAINT bc_investment_selections_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- Name: bc_investment_selections bc_investment_selections_catalog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_investment_selections
    ADD CONSTRAINT bc_investment_selections_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES public.bc_investment_catalog(id) ON DELETE CASCADE;


--
-- Name: bc_investments bc_investments_bc_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_investments
    ADD CONSTRAINT bc_investments_bc_master_id_fkey FOREIGN KEY (bc_master_id) REFERENCES public.bc_master(id) ON DELETE CASCADE;


--
-- Name: bc_investments bc_investments_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_investments
    ADD CONSTRAINT bc_investments_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- Name: bc_lab_environment bc_lab_environment_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_lab_environment
    ADD CONSTRAINT bc_lab_environment_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- Name: bc_lis_data bc_lis_data_bc_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_lis_data
    ADD CONSTRAINT bc_lis_data_bc_master_id_fkey FOREIGN KEY (bc_master_id) REFERENCES public.bc_master(id) ON DELETE CASCADE;


--
-- Name: bc_lis_equipment_interfaces bc_lis_equipment_interfaces_lis_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_lis_equipment_interfaces
    ADD CONSTRAINT bc_lis_equipment_interfaces_lis_integration_id_fkey FOREIGN KEY (bc_lis_data_id) REFERENCES public.bc_lis_integration(id) ON DELETE CASCADE;


--
-- Name: bc_lis_integration bc_lis_integration_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_lis_integration
    ADD CONSTRAINT bc_lis_integration_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- Name: bc_notification_queue bc_notification_queue_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_notification_queue
    ADD CONSTRAINT bc_notification_queue_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- Name: bc_notification_queue bc_notification_queue_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_notification_queue
    ADD CONSTRAINT bc_notification_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: bc_operational_data bc_operational_data_bc_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_operational_data
    ADD CONSTRAINT bc_operational_data_bc_master_id_fkey FOREIGN KEY (bc_master_id) REFERENCES public.bc_master(id) ON DELETE CASCADE;


--
-- Name: bc_requirements bc_requirements_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_requirements
    ADD CONSTRAINT bc_requirements_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- Name: bc_sheet_generation_jobs bc_sheet_generation_jobs_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_sheet_generation_jobs
    ADD CONSTRAINT bc_sheet_generation_jobs_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- Name: bc_sheet_generation_jobs bc_sheet_generation_jobs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_sheet_generation_jobs
    ADD CONSTRAINT bc_sheet_generation_jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: bc_validations bc_validations_bc_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_validations
    ADD CONSTRAINT bc_validations_bc_master_id_fkey FOREIGN KEY (bc_master_id) REFERENCES public.bc_master(id) ON DELETE CASCADE;


--
-- Name: bc_workflow_history bc_workflow_history_bc_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_workflow_history
    ADD CONSTRAINT bc_workflow_history_bc_master_id_fkey FOREIGN KEY (bc_master_id) REFERENCES public.bc_master(id) ON DELETE CASCADE;


--
-- Name: bs_action_item bs_action_item_assignee_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bs_action_item
    ADD CONSTRAINT bs_action_item_assignee_user_id_fkey FOREIGN KEY (assignee_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bs_action_item bs_action_item_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bs_action_item
    ADD CONSTRAINT bs_action_item_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bs_action_item bs_action_item_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bs_action_item
    ADD CONSTRAINT bs_action_item_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.opportunity_flag(id) ON DELETE SET NULL;


--
-- Name: bs_action_item bs_action_item_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bs_action_item
    ADD CONSTRAINT bs_action_item_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.opportunity(id) ON DELETE CASCADE;


--
-- Name: bs_action_item bs_action_item_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bs_action_item
    ADD CONSTRAINT bs_action_item_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.action_templates(id) ON DELETE SET NULL;


--
-- Name: bs_action_item bs_action_item_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bs_action_item
    ADD CONSTRAINT bs_action_item_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bs_comment bs_comment_author_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bs_comment
    ADD CONSTRAINT bs_comment_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bs_comment bs_comment_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bs_comment
    ADD CONSTRAINT bs_comment_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.opportunity(id) ON DELETE CASCADE;


--
-- Name: bs_comment bs_comment_parent_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bs_comment
    ADD CONSTRAINT bs_comment_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.bs_comment(id) ON DELETE CASCADE;


--
-- Name: business_case_feature_flags business_case_feature_flags_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_case_feature_flags
    ADD CONSTRAINT business_case_feature_flags_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: business_case_idempotency_keys business_case_idempotency_keys_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_case_idempotency_keys
    ADD CONSTRAINT business_case_idempotency_keys_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: business_case_section_ownership_audit business_case_section_ownership_audit_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_case_section_ownership_audit
    ADD CONSTRAINT business_case_section_ownership_audit_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- Name: business_case_section_ownership business_case_section_ownership_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_case_section_ownership
    ADD CONSTRAINT business_case_section_ownership_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- Name: business_case_state_transitions business_case_state_transitions_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_case_state_transitions
    ADD CONSTRAINT business_case_state_transitions_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id);


--
-- Name: buying_influence buying_influence_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buying_influence
    ADD CONSTRAINT buying_influence_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: buying_influence buying_influence_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buying_influence
    ADD CONSTRAINT buying_influence_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: buying_influence buying_influence_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buying_influence
    ADD CONSTRAINT buying_influence_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.opportunity(id) ON DELETE CASCADE;


--
-- Name: buying_influence buying_influence_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buying_influence
    ADD CONSTRAINT buying_influence_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ca0101_alarms ca0101_alarms_reading_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ca0101_alarms
    ADD CONSTRAINT ca0101_alarms_reading_id_fkey FOREIGN KEY (reading_id) REFERENCES public.ca0101_readings(id) ON DELETE CASCADE;


--
-- Name: ca0101_readings ca0101_readings_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ca0101_readings
    ADD CONSTRAINT ca0101_readings_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.ca0101_devices(id) ON DELETE CASCADE;


--
-- Name: ca0102_cleaning_logs ca0102_cleaning_logs_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ca0102_cleaning_logs
    ADD CONSTRAINT ca0102_cleaning_logs_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.ca0102_areas(id) ON DELETE RESTRICT;


--
-- Name: ca0104_inspections ca0104_inspections_traps_map_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ca0104_inspections
    ADD CONSTRAINT ca0104_inspections_traps_map_id_fkey FOREIGN KEY (traps_map_id) REFERENCES public.ca0104_traps_map(id) ON DELETE RESTRICT;


--
-- Name: ca0104_toxicity ca0104_toxicity_inspection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ca0104_toxicity
    ADD CONSTRAINT ca0104_toxicity_inspection_id_fkey FOREIGN KEY (inspection_id) REFERENCES public.ca0104_inspections(id) ON DELETE SET NULL;


--
-- Name: calculation_templates calculation_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calculation_templates
    ADD CONSTRAINT calculation_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: catalog_consumables catalog_consumables_replaced_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_consumables
    ADD CONSTRAINT catalog_consumables_replaced_by_id_fkey FOREIGN KEY (replaced_by_id) REFERENCES public.catalog_consumables(id) ON DELETE SET NULL;


--
-- Name: catalog_determinations catalog_determinations_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_determinations
    ADD CONSTRAINT catalog_determinations_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES servicio.equipos(id_equipo) ON DELETE SET NULL;


--
-- Name: catalog_determinations catalog_determinations_replaced_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_determinations
    ADD CONSTRAINT catalog_determinations_replaced_by_id_fkey FOREIGN KEY (replaced_by_id) REFERENCES public.catalog_determinations(id) ON DELETE SET NULL;


--
-- Name: catalog_equipment_consumables catalog_equipment_consumables_consumable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_equipment_consumables
    ADD CONSTRAINT catalog_equipment_consumables_consumable_id_fkey FOREIGN KEY (consumable_id) REFERENCES public.catalog_consumables(id) ON DELETE CASCADE;


--
-- Name: catalog_equipment_consumables catalog_equipment_consumables_determination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_equipment_consumables
    ADD CONSTRAINT catalog_equipment_consumables_determination_id_fkey FOREIGN KEY (determination_id) REFERENCES public.catalog_determinations(id) ON DELETE CASCADE;


--
-- Name: catalog_equipment_consumables catalog_equipment_consumables_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_equipment_consumables
    ADD CONSTRAINT catalog_equipment_consumables_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES servicio.equipos(id_equipo) ON DELETE CASCADE;


--
-- Name: checklist_procesos checklist_procesos_responsable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_procesos
    ADD CONSTRAINT checklist_procesos_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES public.users(id);


--
-- Name: checklist_procesos checklist_procesos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_procesos
    ADD CONSTRAINT checklist_procesos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: checklist_steps checklist_steps_completado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_steps
    ADD CONSTRAINT checklist_steps_completado_por_fkey FOREIGN KEY (completado_por) REFERENCES public.users(id);


--
-- Name: checklist_steps checklist_steps_proceso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_steps
    ADD CONSTRAINT checklist_steps_proceso_id_fkey FOREIGN KEY (proceso_id) REFERENCES public.checklist_procesos(id) ON DELETE CASCADE;


--
-- Name: client_assignments client_assignments_client_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_assignments
    ADD CONSTRAINT client_assignments_client_request_id_fkey FOREIGN KEY (client_request_id) REFERENCES public.client_requests(id) ON DELETE CASCADE;


--
-- Name: client_interactions client_interactions_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_interactions
    ADD CONSTRAINT client_interactions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.client_requests(id) ON DELETE CASCADE;


--
-- Name: client_locations client_locations_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_locations
    ADD CONSTRAINT client_locations_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.client_requests(id) ON DELETE CASCADE;


--
-- Name: client_request_consent_tokens client_request_consent_tokens_used_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_request_consent_tokens
    ADD CONSTRAINT client_request_consent_tokens_used_request_id_fkey FOREIGN KEY (used_request_id) REFERENCES public.client_requests(id) ON DELETE SET NULL;


--
-- Name: client_request_consents client_request_consents_client_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_request_consents
    ADD CONSTRAINT client_request_consents_client_request_id_fkey FOREIGN KEY (client_request_id) REFERENCES public.client_requests(id) ON DELETE CASCADE;


--
-- Name: client_request_quality_checks client_request_quality_checks_client_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_request_quality_checks
    ADD CONSTRAINT client_request_quality_checks_client_request_id_fkey FOREIGN KEY (client_request_id) REFERENCES public.client_requests(id) ON DELETE CASCADE;


--
-- Name: client_request_quality_checks client_request_quality_checks_validated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_request_quality_checks
    ADD CONSTRAINT client_request_quality_checks_validated_by_user_id_fkey FOREIGN KEY (validated_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: client_requests client_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_requests
    ADD CONSTRAINT client_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: client_requests client_requests_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_requests
    ADD CONSTRAINT client_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: client_requests client_requests_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_requests
    ADD CONSTRAINT client_requests_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES crm.crm_opportunities(id);


--
-- Name: client_requests client_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_requests
    ADD CONSTRAINT client_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: client_visit_logs client_visit_logs_client_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_visit_logs
    ADD CONSTRAINT client_visit_logs_client_request_id_fkey FOREIGN KEY (client_request_id) REFERENCES public.client_requests(id) ON DELETE CASCADE;


--
-- Name: clients clients_client_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_client_request_id_fkey FOREIGN KEY (client_request_id) REFERENCES public.client_requests(id) ON DELETE SET NULL;


--
-- Name: clients clients_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: collab_deliveries collab_deliveries_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_deliveries
    ADD CONSTRAINT collab_deliveries_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.collab_item_catalog(id);


--
-- Name: collab_deliveries collab_deliveries_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_deliveries
    ADD CONSTRAINT collab_deliveries_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: collab_deliveries collab_deliveries_delivered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_deliveries
    ADD CONSTRAINT collab_deliveries_delivered_by_fkey FOREIGN KEY (delivered_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: collab_deliveries collab_deliveries_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_deliveries
    ADD CONSTRAINT collab_deliveries_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.collab_delivery_sessions(id) ON DELETE SET NULL;


--
-- Name: collab_deliveries collab_deliveries_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_deliveries
    ADD CONSTRAINT collab_deliveries_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: collab_deliveries collab_deliveries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_deliveries
    ADD CONSTRAINT collab_deliveries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: collab_deliveries collab_deliveries_withdrawn_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_deliveries
    ADD CONSTRAINT collab_deliveries_withdrawn_by_fkey FOREIGN KEY (withdrawn_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: collab_delivery_actas collab_delivery_actas_delivery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_delivery_actas
    ADD CONSTRAINT collab_delivery_actas_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.collab_deliveries(id) ON DELETE SET NULL;


--
-- Name: collab_delivery_actas collab_delivery_actas_generated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_delivery_actas
    ADD CONSTRAINT collab_delivery_actas_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: collab_delivery_actas_items collab_delivery_actas_items_acta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_delivery_actas_items
    ADD CONSTRAINT collab_delivery_actas_items_acta_id_fkey FOREIGN KEY (acta_id) REFERENCES public.collab_delivery_actas(id) ON DELETE CASCADE;


--
-- Name: collab_delivery_actas_items collab_delivery_actas_items_delivery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_delivery_actas_items
    ADD CONSTRAINT collab_delivery_actas_items_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.collab_deliveries(id) ON DELETE SET NULL;


--
-- Name: collab_delivery_actas collab_delivery_actas_recipient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_delivery_actas
    ADD CONSTRAINT collab_delivery_actas_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: collab_delivery_actas collab_delivery_actas_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_delivery_actas
    ADD CONSTRAINT collab_delivery_actas_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.collab_delivery_sessions(id) ON DELETE SET NULL;


--
-- Name: collab_delivery_actas collab_delivery_actas_signature_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_delivery_actas
    ADD CONSTRAINT collab_delivery_actas_signature_workflow_id_fkey FOREIGN KEY (signature_workflow_id) REFERENCES public.signature_workflows(id) ON DELETE SET NULL;


--
-- Name: collab_delivery_actas collab_delivery_actas_signed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_delivery_actas
    ADD CONSTRAINT collab_delivery_actas_signed_by_fkey FOREIGN KEY (signed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: collab_delivery_docs collab_delivery_docs_delivery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_delivery_docs
    ADD CONSTRAINT collab_delivery_docs_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.collab_deliveries(id) ON DELETE CASCADE;


--
-- Name: collab_delivery_docs collab_delivery_docs_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_delivery_docs
    ADD CONSTRAINT collab_delivery_docs_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: collab_delivery_events collab_delivery_events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_delivery_events
    ADD CONSTRAINT collab_delivery_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: collab_delivery_events collab_delivery_events_delivery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_delivery_events
    ADD CONSTRAINT collab_delivery_events_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.collab_deliveries(id) ON DELETE CASCADE;


--
-- Name: collab_delivery_sessions collab_delivery_sessions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_delivery_sessions
    ADD CONSTRAINT collab_delivery_sessions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: collab_delivery_sessions collab_delivery_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_delivery_sessions
    ADD CONSTRAINT collab_delivery_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: collab_item_catalog collab_item_catalog_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_item_catalog
    ADD CONSTRAINT collab_item_catalog_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: collab_renewal_schedule collab_renewal_schedule_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_renewal_schedule
    ADD CONSTRAINT collab_renewal_schedule_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: collab_renewal_schedule collab_renewal_schedule_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_renewal_schedule
    ADD CONSTRAINT collab_renewal_schedule_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: collab_renewal_schedule collab_renewal_schedule_delivery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_renewal_schedule
    ADD CONSTRAINT collab_renewal_schedule_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.collab_deliveries(id) ON DELETE CASCADE;


--
-- Name: collaborator_documents collaborator_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaborator_documents
    ADD CONSTRAINT collaborator_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: collaborator_documents collaborator_documents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaborator_documents
    ADD CONSTRAINT collaborator_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: collaborator_profiles collaborator_profiles_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaborator_profiles
    ADD CONSTRAINT collaborator_profiles_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: collaborator_profiles collaborator_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaborator_profiles
    ADD CONSTRAINT collaborator_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: collaborator_qualifications collaborator_qualifications_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaborator_qualifications
    ADD CONSTRAINT collaborator_qualifications_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: collaborator_qualifications collaborator_qualifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaborator_qualifications
    ADD CONSTRAINT collaborator_qualifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: competitor competitor_competitor_catalog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitor
    ADD CONSTRAINT competitor_competitor_catalog_id_fkey FOREIGN KEY (competitor_catalog_id) REFERENCES public.competitor_catalog(id) ON DELETE SET NULL;


--
-- Name: competitor competitor_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitor
    ADD CONSTRAINT competitor_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: competitor competitor_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitor
    ADD CONSTRAINT competitor_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.opportunity(id) ON DELETE CASCADE;


--
-- Name: competitor competitor_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitor
    ADD CONSTRAINT competitor_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: consumable_dispatch_lines consumable_dispatch_lines_carried_forward_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_dispatch_lines
    ADD CONSTRAINT consumable_dispatch_lines_carried_forward_order_id_fkey FOREIGN KEY (carried_forward_order_id) REFERENCES public.consumable_orders(id) ON DELETE SET NULL;


--
-- Name: consumable_dispatch_lines consumable_dispatch_lines_consumable_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_dispatch_lines
    ADD CONSTRAINT consumable_dispatch_lines_consumable_order_id_fkey FOREIGN KEY (consumable_order_id) REFERENCES public.consumable_orders(id) ON DELETE CASCADE;


--
-- Name: consumable_dispatch_lines consumable_dispatch_lines_consumable_order_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_dispatch_lines
    ADD CONSTRAINT consumable_dispatch_lines_consumable_order_line_id_fkey FOREIGN KEY (consumable_order_line_id) REFERENCES public.consumable_order_lines(id) ON DELETE CASCADE;


--
-- Name: consumable_dispatch_lines consumable_dispatch_lines_dispatched_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_dispatch_lines
    ADD CONSTRAINT consumable_dispatch_lines_dispatched_by_fkey FOREIGN KEY (dispatched_by) REFERENCES public.users(id);


--
-- Name: consumable_file_lines consumable_file_lines_catalog_consumable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_file_lines
    ADD CONSTRAINT consumable_file_lines_catalog_consumable_id_fkey FOREIGN KEY (catalog_consumable_id) REFERENCES public.catalog_consumables(id) ON DELETE SET NULL;


--
-- Name: consumable_file_lines consumable_file_lines_consumable_file_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_file_lines
    ADD CONSTRAINT consumable_file_lines_consumable_file_section_id_fkey FOREIGN KEY (consumable_file_section_id) REFERENCES public.consumable_file_sections(id) ON DELETE CASCADE;


--
-- Name: consumable_file_lines consumable_file_lines_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_file_lines
    ADD CONSTRAINT consumable_file_lines_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: consumable_file_sections consumable_file_sections_consumable_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_file_sections
    ADD CONSTRAINT consumable_file_sections_consumable_file_id_fkey FOREIGN KEY (consumable_file_id) REFERENCES public.consumable_files(id) ON DELETE CASCADE;


--
-- Name: consumable_files consumable_files_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_files
    ADD CONSTRAINT consumable_files_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: consumable_files consumable_files_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_files
    ADD CONSTRAINT consumable_files_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: consumable_files consumable_files_equipment_purchase_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_files
    ADD CONSTRAINT consumable_files_equipment_purchase_request_id_fkey FOREIGN KEY (equipment_purchase_request_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE SET NULL;


--
-- Name: consumable_files consumable_files_private_purchase_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_files
    ADD CONSTRAINT consumable_files_private_purchase_request_id_fkey FOREIGN KEY (private_purchase_request_id) REFERENCES public.private_purchase_requests(id) ON DELETE SET NULL;


--
-- Name: consumable_order_lines consumable_order_lines_consumable_file_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_order_lines
    ADD CONSTRAINT consumable_order_lines_consumable_file_line_id_fkey FOREIGN KEY (consumable_file_line_id) REFERENCES public.consumable_file_lines(id) ON DELETE RESTRICT;


--
-- Name: consumable_order_lines consumable_order_lines_consumable_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_order_lines
    ADD CONSTRAINT consumable_order_lines_consumable_order_id_fkey FOREIGN KEY (consumable_order_id) REFERENCES public.consumable_orders(id) ON DELETE CASCADE;


--
-- Name: consumable_orders consumable_orders_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_orders
    ADD CONSTRAINT consumable_orders_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: consumable_orders consumable_orders_consumable_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_orders
    ADD CONSTRAINT consumable_orders_consumable_file_id_fkey FOREIGN KEY (consumable_file_id) REFERENCES public.consumable_files(id) ON DELETE CASCADE;


--
-- Name: consumable_orders consumable_orders_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumable_orders
    ADD CONSTRAINT consumable_orders_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: contacts contacts_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: contacts contacts_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: contract_determinations contract_determinations_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_determinations
    ADD CONSTRAINT contract_determinations_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- Name: contract_determinations contract_determinations_determination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_determinations
    ADD CONSTRAINT contract_determinations_determination_id_fkey FOREIGN KEY (determination_id) REFERENCES public.catalog_determinations(id) ON DELETE SET NULL;


--
-- Name: delivery_ceiling_audit delivery_ceiling_audit_business_case_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_ceiling_audit
    ADD CONSTRAINT delivery_ceiling_audit_business_case_fk FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- Name: delivery_ceiling_audit delivery_ceiling_audit_delivery_ceiling_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_ceiling_audit
    ADD CONSTRAINT delivery_ceiling_audit_delivery_ceiling_fk FOREIGN KEY (delivery_ceiling_id) REFERENCES public.delivery_ceiling(id) ON DELETE CASCADE;


--
-- Name: delivery_ceiling_audit delivery_ceiling_audit_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_ceiling_audit
    ADD CONSTRAINT delivery_ceiling_audit_user_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: delivery_ceiling delivery_ceiling_business_case_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_ceiling
    ADD CONSTRAINT delivery_ceiling_business_case_fk FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- Name: delivery_ceiling delivery_ceiling_created_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_ceiling
    ADD CONSTRAINT delivery_ceiling_created_by_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: delivery_ceiling_line delivery_ceiling_line_delivery_ceiling_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_ceiling_line
    ADD CONSTRAINT delivery_ceiling_line_delivery_ceiling_fk FOREIGN KEY (delivery_ceiling_id) REFERENCES public.delivery_ceiling(id) ON DELETE CASCADE;


--
-- Name: delivery_ceiling_line delivery_ceiling_line_equipment_model_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_ceiling_line
    ADD CONSTRAINT delivery_ceiling_line_equipment_model_fk FOREIGN KEY (equipment_model_id) REFERENCES public.equipment_models(id) ON DELETE SET NULL;


--
-- Name: delivery_ceiling_line delivery_ceiling_line_product_map_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_ceiling_line
    ADD CONSTRAINT delivery_ceiling_line_product_map_fk FOREIGN KEY (integration_product_map_id) REFERENCES public.integration_product_map(id) ON DELETE SET NULL;


--
-- Name: delivery_ceiling delivery_ceiling_private_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_ceiling
    ADD CONSTRAINT delivery_ceiling_private_purchase_id_fkey FOREIGN KEY (private_purchase_id) REFERENCES public.private_purchase_requests(id) ON DELETE SET NULL;


--
-- Name: delivery_ceiling delivery_ceiling_updated_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_ceiling
    ADD CONSTRAINT delivery_ceiling_updated_by_fk FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: delivery_dispatch delivery_dispatch_delivery_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_dispatch
    ADD CONSTRAINT delivery_dispatch_delivery_request_id_fkey FOREIGN KEY (delivery_request_id) REFERENCES public.delivery_request(id);


--
-- Name: delivery_dispatch_line delivery_dispatch_line_delivery_ceiling_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_dispatch_line
    ADD CONSTRAINT delivery_dispatch_line_delivery_ceiling_line_id_fkey FOREIGN KEY (delivery_ceiling_line_id) REFERENCES public.delivery_ceiling_line(id);


--
-- Name: delivery_dispatch_line delivery_dispatch_line_delivery_dispatch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_dispatch_line
    ADD CONSTRAINT delivery_dispatch_line_delivery_dispatch_id_fkey FOREIGN KEY (delivery_dispatch_id) REFERENCES public.delivery_dispatch(id);


--
-- Name: delivery_request delivery_request_confirmed_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_request
    ADD CONSTRAINT delivery_request_confirmed_by_fk FOREIGN KEY (confirmed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: delivery_request delivery_request_delivery_ceiling_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_request
    ADD CONSTRAINT delivery_request_delivery_ceiling_fk FOREIGN KEY (delivery_ceiling_id) REFERENCES public.delivery_ceiling(id) ON DELETE CASCADE;


--
-- Name: delivery_request_line delivery_request_line_ceiling_line_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_request_line
    ADD CONSTRAINT delivery_request_line_ceiling_line_fk FOREIGN KEY (delivery_ceiling_line_id) REFERENCES public.delivery_ceiling_line(id) ON DELETE RESTRICT;


--
-- Name: delivery_request_line delivery_request_line_request_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_request_line
    ADD CONSTRAINT delivery_request_line_request_fk FOREIGN KEY (delivery_request_id) REFERENCES public.delivery_request(id) ON DELETE CASCADE;


--
-- Name: delivery_request delivery_request_requested_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_request
    ADD CONSTRAINT delivery_request_requested_by_fk FOREIGN KEY (requested_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: determination_consumption_log determination_consumption_log_contract_determination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.determination_consumption_log
    ADD CONSTRAINT determination_consumption_log_contract_determination_id_fkey FOREIGN KEY (contract_determination_id) REFERENCES public.contract_determinations(id) ON DELETE CASCADE;


--
-- Name: document_hashes document_hashes_calculated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_hashes
    ADD CONSTRAINT document_hashes_calculated_by_fkey FOREIGN KEY (calculated_by) REFERENCES public.users(id);


--
-- Name: document_qr_codes document_qr_codes_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_qr_codes
    ADD CONSTRAINT document_qr_codes_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- Name: document_qr_codes document_qr_codes_seal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_qr_codes
    ADD CONSTRAINT document_qr_codes_seal_id_fkey FOREIGN KEY (seal_id) REFERENCES public.document_seals(id);


--
-- Name: document_seals document_seals_authorized_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_seals
    ADD CONSTRAINT document_seals_authorized_user_id_fkey FOREIGN KEY (authorized_user_id) REFERENCES public.users(id);


--
-- Name: document_seals document_seals_document_hash_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_seals
    ADD CONSTRAINT document_seals_document_hash_id_fkey FOREIGN KEY (document_hash_id) REFERENCES public.document_hashes(id);


--
-- Name: document_seals document_seals_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_seals
    ADD CONSTRAINT document_seals_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- Name: document_signature_logs document_signature_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_signature_logs
    ADD CONSTRAINT document_signature_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: document_signatures_advanced document_signatures_advanced_document_hash_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_signatures_advanced
    ADD CONSTRAINT document_signatures_advanced_document_hash_id_fkey FOREIGN KEY (document_hash_id) REFERENCES public.document_hashes(id);


--
-- Name: document_signatures_advanced document_signatures_advanced_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_signatures_advanced
    ADD CONSTRAINT document_signatures_advanced_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- Name: document_signatures_advanced document_signatures_advanced_signer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_signatures_advanced
    ADD CONSTRAINT document_signatures_advanced_signer_user_id_fkey FOREIGN KEY (signer_user_id) REFERENCES public.users(id);


--
-- Name: document_signatures document_signatures_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_signatures
    ADD CONSTRAINT document_signatures_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_signatures document_signatures_signer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_signatures
    ADD CONSTRAINT document_signatures_signer_user_id_fkey FOREIGN KEY (signer_user_id) REFERENCES public.users(id);


--
-- Name: document_verifications document_verifications_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_verifications
    ADD CONSTRAINT document_verifications_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- Name: documents documents_current_hash_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_current_hash_id_fkey FOREIGN KEY (current_hash_id) REFERENCES public.document_hashes(id);


--
-- Name: documents documents_locked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_locked_by_fkey FOREIGN KEY (locked_by) REFERENCES public.users(id);


--
-- Name: documents documents_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE CASCADE;


--
-- Name: documents documents_request_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_request_type_id_fkey FOREIGN KEY (request_type_id) REFERENCES public.request_types(id) ON DELETE CASCADE;


--
-- Name: employee_contracts employee_contracts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_contracts
    ADD CONSTRAINT employee_contracts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: employee_contracts employee_contracts_departamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_contracts
    ADD CONSTRAINT employee_contracts_departamento_id_fkey FOREIGN KEY (departamento_id) REFERENCES public.departments(id);


--
-- Name: employee_contracts employee_contracts_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_contracts
    ADD CONSTRAINT employee_contracts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: employee_contracts employee_contracts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_contracts
    ADD CONSTRAINT employee_contracts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: equipment_asset_events equipment_asset_events_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_asset_events
    ADD CONSTRAINT equipment_asset_events_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.equipment_assets(id) ON DELETE CASCADE;


--
-- Name: equipment_asset_events equipment_asset_events_from_status_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_asset_events
    ADD CONSTRAINT equipment_asset_events_from_status_fkey FOREIGN KEY (from_status) REFERENCES public.equipment_asset_status_catalog(code);


--
-- Name: equipment_asset_events equipment_asset_events_to_status_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_asset_events
    ADD CONSTRAINT equipment_asset_events_to_status_fkey FOREIGN KEY (to_status) REFERENCES public.equipment_asset_status_catalog(code);


--
-- Name: equipment_asset_maintenance_schedule equipment_asset_maintenance_schedule_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_asset_maintenance_schedule
    ADD CONSTRAINT equipment_asset_maintenance_schedule_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.equipment_assets(id) ON DELETE CASCADE;


--
-- Name: equipment_asset_maintenance_schedule equipment_asset_maintenance_schedule_procedure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_asset_maintenance_schedule
    ADD CONSTRAINT equipment_asset_maintenance_schedule_procedure_id_fkey FOREIGN KEY (procedure_id) REFERENCES public.maintenance_procedures(id) ON DELETE RESTRICT;


--
-- Name: equipment_asset_maintenance_schedule equipment_asset_maintenance_schedule_source_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_asset_maintenance_schedule
    ADD CONSTRAINT equipment_asset_maintenance_schedule_source_event_id_fkey FOREIGN KEY (source_event_id) REFERENCES public.equipment_asset_events(id) ON DELETE SET NULL;


--
-- Name: equipment_asset_reservations equipment_asset_reservations_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_asset_reservations
    ADD CONSTRAINT equipment_asset_reservations_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.equipment_assets(id) ON DELETE CASCADE;


--
-- Name: equipment_assets equipment_assets_current_status_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_assets
    ADD CONSTRAINT equipment_assets_current_status_fkey FOREIGN KEY (current_status) REFERENCES public.equipment_asset_status_catalog(code);


--
-- Name: equipment_assets equipment_assets_equipment_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_assets
    ADD CONSTRAINT equipment_assets_equipment_model_id_fkey FOREIGN KEY (equipment_model_id) REFERENCES public.equipment_models(id) ON DELETE RESTRICT;


--
-- Name: equipment_maintenance_parts equipment_maintenance_parts_equipment_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_maintenance_parts
    ADD CONSTRAINT equipment_maintenance_parts_equipment_model_id_fkey FOREIGN KEY (equipment_model_id) REFERENCES public.equipment_models(id) ON DELETE CASCADE;


--
-- Name: equipment_models equipment_models_servicio_equipo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_models
    ADD CONSTRAINT equipment_models_servicio_equipo_id_fkey FOREIGN KEY (servicio_equipo_id) REFERENCES servicio.equipos(id_equipo) ON DELETE SET NULL;


--
-- Name: equipment_price_history equipment_price_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_price_history
    ADD CONSTRAINT equipment_price_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: equipment_price_history equipment_price_history_consumable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_price_history
    ADD CONSTRAINT equipment_price_history_consumable_id_fkey FOREIGN KEY (consumable_id) REFERENCES public.catalog_consumables(id);


--
-- Name: equipment_price_history equipment_price_history_determination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_price_history
    ADD CONSTRAINT equipment_price_history_determination_id_fkey FOREIGN KEY (determination_id) REFERENCES public.catalog_determinations(id);


--
-- Name: equipment_price_history equipment_price_history_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_price_history
    ADD CONSTRAINT equipment_price_history_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES servicio.equipos(id_equipo);


--
-- Name: equipment_purchase_business_case_links equipment_purchase_business_case_lin_equipment_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_purchase_business_case_links
    ADD CONSTRAINT equipment_purchase_business_case_lin_equipment_purchase_id_fkey FOREIGN KEY (equipment_purchase_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- Name: equipment_purchase_business_case_links equipment_purchase_business_case_links_business_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_purchase_business_case_links
    ADD CONSTRAINT equipment_purchase_business_case_links_business_case_id_fkey FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- Name: equipment_purchase_requests equipment_purchase_requests_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_purchase_requests
    ADD CONSTRAINT equipment_purchase_requests_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES crm.crm_opportunities(id);


--
-- Name: equipment_purchase_requests equipment_purchase_requests_participation_decision_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_purchase_requests
    ADD CONSTRAINT equipment_purchase_requests_participation_decision_by_fkey FOREIGN KEY (participation_decision_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: equipment_purchase_requests equipment_purchase_requests_v2_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_purchase_requests
    ADD CONSTRAINT equipment_purchase_requests_v2_request_id_fkey FOREIGN KEY (v2_request_id) REFERENCES public.requests(id);


--
-- Name: equipos_historial equipos_historial_unidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipos_historial
    ADD CONSTRAINT equipos_historial_unidad_id_fkey FOREIGN KEY (unidad_id) REFERENCES public.equipos_unidad(id) ON DELETE CASCADE;


--
-- Name: equipos_movimientos equipos_movimientos_equipo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipos_movimientos
    ADD CONSTRAINT equipos_movimientos_equipo_id_fkey FOREIGN KEY (equipo_id) REFERENCES public.equipos(id) ON DELETE CASCADE;


--
-- Name: equipos_unidad equipos_unidad_modelo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipos_unidad
    ADD CONSTRAINT equipos_unidad_modelo_id_fkey FOREIGN KEY (modelo_id) REFERENCES public.equipos_modelo(id) ON DELETE CASCADE;


--
-- Name: equipos_unidad equipos_unidad_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipos_unidad
    ADD CONSTRAINT equipos_unidad_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE SET NULL;


--
-- Name: famdays_configurators famdays_configurators_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.famdays_configurators
    ADD CONSTRAINT famdays_configurators_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: famdays_configurators famdays_configurators_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.famdays_configurators
    ADD CONSTRAINT famdays_configurators_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: famdays_event_qr_tokens famdays_event_qr_tokens_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.famdays_event_qr_tokens
    ADD CONSTRAINT famdays_event_qr_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: famdays_event_qr_tokens famdays_event_qr_tokens_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.famdays_event_qr_tokens
    ADD CONSTRAINT famdays_event_qr_tokens_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.kickoff_events(id) ON DELETE CASCADE;


--
-- Name: bc_audit_log fk_bc_audit_log_bc; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_audit_log
    ADD CONSTRAINT fk_bc_audit_log_bc FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- Name: bc_calculations fk_bc_calculations_bc; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_calculations
    ADD CONSTRAINT fk_bc_calculations_bc FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- Name: bc_determinations fk_bc_determinations_bc; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_determinations
    ADD CONSTRAINT fk_bc_determinations_bc FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;


--
-- Name: bc_lis_equipment_interfaces fk_bc_lis_equipment_interfaces_lis_integration; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_lis_equipment_interfaces
    ADD CONSTRAINT fk_bc_lis_equipment_interfaces_lis_integration FOREIGN KEY (lis_integration_id) REFERENCES public.bc_lis_integration(id) ON DELETE SET NULL;


--
-- Name: purchase_delivery_schedules fk_purchase_delivery_schedules_request_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_delivery_schedules
    ADD CONSTRAINT fk_purchase_delivery_schedules_request_id FOREIGN KEY (private_purchase_request_id) REFERENCES public.private_purchase_requests(id) ON DELETE CASCADE;


--
-- Name: purchase_delivery_schedules fk_purchase_delivery_schedules_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_delivery_schedules
    ADD CONSTRAINT fk_purchase_delivery_schedules_user_id FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: user_gmail_tokens fk_user_gmail_tokens_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_gmail_tokens
    ADD CONSTRAINT fk_user_gmail_tokens_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users fk_users_department; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_department FOREIGN KEY (department_id) REFERENCES public.departments(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: users fk_users_departments; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_departments FOREIGN KEY (department_id) REFERENCES public.departments(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: hiring_salary_proposals hiring_salary_proposals_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_salary_proposals
    ADD CONSTRAINT hiring_salary_proposals_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: hiring_salary_proposals hiring_salary_proposals_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_salary_proposals
    ADD CONSTRAINT hiring_salary_proposals_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.applicant_pipeline_entries(id) ON DELETE CASCADE;


--
-- Name: integration_product_map integration_product_map_spi_equipment_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_product_map
    ADD CONSTRAINT integration_product_map_spi_equipment_model_id_fkey FOREIGN KEY (spi_equipment_model_id) REFERENCES public.equipment_models(id) ON DELETE SET NULL;


--
-- Name: inventory_movements inventory_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: inventory_movements inventory_movements_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id);


--
-- Name: kickoff_aporte_ratings kickoff_aporte_ratings_aporte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_aporte_ratings
    ADD CONSTRAINT kickoff_aporte_ratings_aporte_id_fkey FOREIGN KEY (aporte_id) REFERENCES public.kickoff_questions(id) ON DELETE CASCADE;


--
-- Name: kickoff_aporte_ratings kickoff_aporte_ratings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_aporte_ratings
    ADD CONSTRAINT kickoff_aporte_ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: kickoff_events kickoff_events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_events
    ADD CONSTRAINT kickoff_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: kickoff_events kickoff_events_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_events
    ADD CONSTRAINT kickoff_events_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: kickoff_presentation_blocks kickoff_presentation_blocks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_presentation_blocks
    ADD CONSTRAINT kickoff_presentation_blocks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: kickoff_presentation_blocks kickoff_presentation_blocks_presentation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_presentation_blocks
    ADD CONSTRAINT kickoff_presentation_blocks_presentation_id_fkey FOREIGN KEY (presentation_id) REFERENCES public.kickoff_presentations(id) ON DELETE CASCADE;


--
-- Name: kickoff_presentation_blocks kickoff_presentation_blocks_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_presentation_blocks
    ADD CONSTRAINT kickoff_presentation_blocks_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: kickoff_presentation_ratings kickoff_presentation_ratings_presentation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_presentation_ratings
    ADD CONSTRAINT kickoff_presentation_ratings_presentation_id_fkey FOREIGN KEY (presentation_id) REFERENCES public.kickoff_presentations(id) ON DELETE CASCADE;


--
-- Name: kickoff_presentation_ratings kickoff_presentation_ratings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_presentation_ratings
    ADD CONSTRAINT kickoff_presentation_ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: kickoff_presentations kickoff_presentations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_presentations
    ADD CONSTRAINT kickoff_presentations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: kickoff_presentations kickoff_presentations_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_presentations
    ADD CONSTRAINT kickoff_presentations_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.kickoff_events(id) ON DELETE CASCADE;


--
-- Name: kickoff_presentations kickoff_presentations_presenter_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_presentations
    ADD CONSTRAINT kickoff_presentations_presenter_user_id_fkey FOREIGN KEY (presenter_user_id) REFERENCES public.users(id);


--
-- Name: kickoff_presentations kickoff_presentations_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_presentations
    ADD CONSTRAINT kickoff_presentations_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: kickoff_qr_tokens kickoff_qr_tokens_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_qr_tokens
    ADD CONSTRAINT kickoff_qr_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: kickoff_qr_tokens kickoff_qr_tokens_presentation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_qr_tokens
    ADD CONSTRAINT kickoff_qr_tokens_presentation_id_fkey FOREIGN KEY (presentation_id) REFERENCES public.kickoff_presentations(id) ON DELETE CASCADE;


--
-- Name: kickoff_question_ratings kickoff_question_ratings_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_question_ratings
    ADD CONSTRAINT kickoff_question_ratings_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.kickoff_questions(id) ON DELETE CASCADE;


--
-- Name: kickoff_question_ratings kickoff_question_ratings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_question_ratings
    ADD CONSTRAINT kickoff_question_ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: kickoff_questions kickoff_questions_answered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_questions
    ADD CONSTRAINT kickoff_questions_answered_by_fkey FOREIGN KEY (answered_by) REFERENCES public.users(id);


--
-- Name: kickoff_questions kickoff_questions_presentation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_questions
    ADD CONSTRAINT kickoff_questions_presentation_id_fkey FOREIGN KEY (presentation_id) REFERENCES public.kickoff_presentations(id) ON DELETE CASCADE;


--
-- Name: kickoff_questions kickoff_questions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_questions
    ADD CONSTRAINT kickoff_questions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: kickoff_tiebreaker_candidates kickoff_tiebreaker_candidates_aporte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_tiebreaker_candidates
    ADD CONSTRAINT kickoff_tiebreaker_candidates_aporte_id_fkey FOREIGN KEY (aporte_id) REFERENCES public.kickoff_questions(id) ON DELETE CASCADE;


--
-- Name: kickoff_tiebreaker_candidates kickoff_tiebreaker_candidates_round_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_tiebreaker_candidates
    ADD CONSTRAINT kickoff_tiebreaker_candidates_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.kickoff_tiebreaker_rounds(id) ON DELETE CASCADE;


--
-- Name: kickoff_tiebreaker_rounds kickoff_tiebreaker_rounds_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_tiebreaker_rounds
    ADD CONSTRAINT kickoff_tiebreaker_rounds_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: kickoff_tiebreaker_rounds kickoff_tiebreaker_rounds_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_tiebreaker_rounds
    ADD CONSTRAINT kickoff_tiebreaker_rounds_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.kickoff_events(id) ON DELETE CASCADE;


--
-- Name: kickoff_tiebreaker_rounds kickoff_tiebreaker_rounds_finished_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_tiebreaker_rounds
    ADD CONSTRAINT kickoff_tiebreaker_rounds_finished_by_fkey FOREIGN KEY (finished_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: kickoff_tiebreaker_rounds kickoff_tiebreaker_rounds_winner_aporte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_tiebreaker_rounds
    ADD CONSTRAINT kickoff_tiebreaker_rounds_winner_aporte_id_fkey FOREIGN KEY (winner_aporte_id) REFERENCES public.kickoff_questions(id);


--
-- Name: kickoff_tiebreaker_votes kickoff_tiebreaker_votes_aporte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_tiebreaker_votes
    ADD CONSTRAINT kickoff_tiebreaker_votes_aporte_id_fkey FOREIGN KEY (aporte_id) REFERENCES public.kickoff_questions(id) ON DELETE CASCADE;


--
-- Name: kickoff_tiebreaker_votes kickoff_tiebreaker_votes_round_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_tiebreaker_votes
    ADD CONSTRAINT kickoff_tiebreaker_votes_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.kickoff_tiebreaker_rounds(id) ON DELETE CASCADE;


--
-- Name: kickoff_tiebreaker_votes kickoff_tiebreaker_votes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kickoff_tiebreaker_votes
    ADD CONSTRAINT kickoff_tiebreaker_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: maintenance_procedure_materials maintenance_procedure_materials_procedure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_procedure_materials
    ADD CONSTRAINT maintenance_procedure_materials_procedure_id_fkey FOREIGN KEY (procedure_id) REFERENCES public.maintenance_procedures(id) ON DELETE CASCADE;


--
-- Name: maintenance_procedure_parts maintenance_procedure_parts_part_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_procedure_parts
    ADD CONSTRAINT maintenance_procedure_parts_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.part_catalog(id) ON DELETE RESTRICT;


--
-- Name: maintenance_procedure_parts maintenance_procedure_parts_procedure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_procedure_parts
    ADD CONSTRAINT maintenance_procedure_parts_procedure_id_fkey FOREIGN KEY (procedure_id) REFERENCES public.maintenance_procedures(id) ON DELETE CASCADE;


--
-- Name: maintenance_procedures maintenance_procedures_equipment_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_procedures
    ADD CONSTRAINT maintenance_procedures_equipment_model_id_fkey FOREIGN KEY (equipment_model_id) REFERENCES public.equipment_models(id) ON DELETE CASCADE;


--
-- Name: module_global_status module_global_status_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_global_status
    ADD CONSTRAINT module_global_status_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: notification_dispatch_queue notification_dispatch_queue_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_dispatch_queue
    ADD CONSTRAINT notification_dispatch_queue_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE;


--
-- Name: notification_process_email_threads notification_process_email_threads_last_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_process_email_threads
    ADD CONSTRAINT notification_process_email_threads_last_notification_id_fkey FOREIGN KEY (last_notification_id) REFERENCES public.notifications(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: offboarding_processes offboarding_processes_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_processes
    ADD CONSTRAINT offboarding_processes_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: offboarding_processes offboarding_processes_generated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_processes
    ADD CONSTRAINT offboarding_processes_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: offboarding_processes offboarding_processes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_processes
    ADD CONSTRAINT offboarding_processes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: offboarding_tasks offboarding_tasks_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_tasks
    ADD CONSTRAINT offboarding_tasks_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: offboarding_tasks offboarding_tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_tasks
    ADD CONSTRAINT offboarding_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: opportunity opportunity_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity
    ADD CONSTRAINT opportunity_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: opportunity opportunity_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity
    ADD CONSTRAINT opportunity_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: opportunity_flag opportunity_flag_buying_influence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity_flag
    ADD CONSTRAINT opportunity_flag_buying_influence_id_fkey FOREIGN KEY (buying_influence_id) REFERENCES public.buying_influence(id) ON DELETE SET NULL;


--
-- Name: opportunity_flag opportunity_flag_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity_flag
    ADD CONSTRAINT opportunity_flag_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: opportunity_flag opportunity_flag_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity_flag
    ADD CONSTRAINT opportunity_flag_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.opportunity(id) ON DELETE CASCADE;


--
-- Name: opportunity_flag opportunity_flag_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity_flag
    ADD CONSTRAINT opportunity_flag_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.red_flag_templates(id) ON DELETE SET NULL;


--
-- Name: opportunity_flag opportunity_flag_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity_flag
    ADD CONSTRAINT opportunity_flag_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: opportunity opportunity_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity
    ADD CONSTRAINT opportunity_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: opportunity_process_link opportunity_process_link_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity_process_link
    ADD CONSTRAINT opportunity_process_link_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: opportunity_process_link opportunity_process_link_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity_process_link
    ADD CONSTRAINT opportunity_process_link_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.opportunity(id) ON DELETE CASCADE;


--
-- Name: opportunity_rating opportunity_rating_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity_rating
    ADD CONSTRAINT opportunity_rating_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.opportunity(id) ON DELETE CASCADE;


--
-- Name: opportunity_rating opportunity_rating_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity_rating
    ADD CONSTRAINT opportunity_rating_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: opportunity_snapshot opportunity_snapshot_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity_snapshot
    ADD CONSTRAINT opportunity_snapshot_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: opportunity_snapshot opportunity_snapshot_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity_snapshot
    ADD CONSTRAINT opportunity_snapshot_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.opportunity(id) ON DELETE CASCADE;


--
-- Name: opportunity opportunity_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity
    ADD CONSTRAINT opportunity_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: permisos_estudios_matriculas permisos_estudios_matriculas_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_estudios_matriculas
    ADD CONSTRAINT permisos_estudios_matriculas_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: permisos_estudios_matriculas permisos_estudios_matriculas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_estudios_matriculas
    ADD CONSTRAINT permisos_estudios_matriculas_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: permisos_vacaciones_firmas permisos_vacaciones_firmas_signer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_vacaciones_firmas
    ADD CONSTRAINT permisos_vacaciones_firmas_signer_user_id_fkey FOREIGN KEY (signer_user_id) REFERENCES public.users(id);


--
-- Name: permisos_vacaciones_firmas permisos_vacaciones_firmas_solicitud_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_vacaciones_firmas
    ADD CONSTRAINT permisos_vacaciones_firmas_solicitud_id_fkey FOREIGN KEY (solicitud_id) REFERENCES public.permisos_vacaciones(id) ON DELETE CASCADE;


--
-- Name: personnel_request_comments personnel_request_comments_personnel_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_request_comments
    ADD CONSTRAINT personnel_request_comments_personnel_request_id_fkey FOREIGN KEY (personnel_request_id) REFERENCES public.personnel_requests(id) ON DELETE CASCADE;


--
-- Name: personnel_request_comments personnel_request_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_request_comments
    ADD CONSTRAINT personnel_request_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: personnel_request_documents personnel_request_documents_personnel_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_request_documents
    ADD CONSTRAINT personnel_request_documents_personnel_request_id_fkey FOREIGN KEY (personnel_request_id) REFERENCES public.personnel_requests(id) ON DELETE CASCADE;


--
-- Name: personnel_request_documents personnel_request_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_request_documents
    ADD CONSTRAINT personnel_request_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: personnel_request_history personnel_request_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_request_history
    ADD CONSTRAINT personnel_request_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: personnel_request_history personnel_request_history_personnel_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_request_history
    ADD CONSTRAINT personnel_request_history_personnel_request_id_fkey FOREIGN KEY (personnel_request_id) REFERENCES public.personnel_requests(id) ON DELETE CASCADE;


--
-- Name: personnel_request_profiles personnel_request_profiles_personnel_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_request_profiles
    ADD CONSTRAINT personnel_request_profiles_personnel_request_id_fkey FOREIGN KEY (personnel_request_id) REFERENCES public.personnel_requests(id) ON DELETE CASCADE;


--
-- Name: personnel_request_profiles personnel_request_profiles_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_request_profiles
    ADD CONSTRAINT personnel_request_profiles_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: personnel_requests personnel_requests_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_requests
    ADD CONSTRAINT personnel_requests_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.applicants(id);


--
-- Name: personnel_requests personnel_requests_approved_by_finance_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_requests
    ADD CONSTRAINT personnel_requests_approved_by_finance_fkey FOREIGN KEY (approved_by_finance) REFERENCES public.users(id);


--
-- Name: personnel_requests personnel_requests_approved_by_hr_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_requests
    ADD CONSTRAINT personnel_requests_approved_by_hr_fkey FOREIGN KEY (approved_by_hr) REFERENCES public.users(id);


--
-- Name: personnel_requests personnel_requests_approved_by_manager_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_requests
    ADD CONSTRAINT personnel_requests_approved_by_manager_fkey FOREIGN KEY (approved_by_manager) REFERENCES public.users(id);


--
-- Name: personnel_requests personnel_requests_collaborator_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_requests
    ADD CONSTRAINT personnel_requests_collaborator_user_id_fkey FOREIGN KEY (collaborator_user_id) REFERENCES public.users(id);


--
-- Name: personnel_requests personnel_requests_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_requests
    ADD CONSTRAINT personnel_requests_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: personnel_requests personnel_requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_requests
    ADD CONSTRAINT personnel_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: private_purchase_requests private_purchase_requests_client_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.private_purchase_requests
    ADD CONSTRAINT private_purchase_requests_client_request_id_fkey FOREIGN KEY (client_request_id) REFERENCES public.client_requests(id) ON DELETE SET NULL;


--
-- Name: private_purchase_requests private_purchase_requests_equipment_purchase_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.private_purchase_requests
    ADD CONSTRAINT private_purchase_requests_equipment_purchase_request_id_fkey FOREIGN KEY (equipment_purchase_request_id) REFERENCES public.equipment_purchase_requests(id);


--
-- Name: private_purchase_requests private_purchase_requests_manager_contract_decision_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.private_purchase_requests
    ADD CONSTRAINT private_purchase_requests_manager_contract_decision_by_fkey FOREIGN KEY (manager_contract_decision_by) REFERENCES public.users(id);


--
-- Name: private_purchase_requests private_purchase_requests_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.private_purchase_requests
    ADD CONSTRAINT private_purchase_requests_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES crm.crm_opportunities(id);


--
-- Name: prospect_visits prospect_visits_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_visits
    ADD CONSTRAINT prospect_visits_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES crm.crm_leads(id);


--
-- Name: public_delivery_plan public_delivery_plan_approved_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_delivery_plan
    ADD CONSTRAINT public_delivery_plan_approved_by_fk FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: public_delivery_plan public_delivery_plan_created_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_delivery_plan
    ADD CONSTRAINT public_delivery_plan_created_by_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: public_delivery_plan public_delivery_plan_delivery_ceiling_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_delivery_plan
    ADD CONSTRAINT public_delivery_plan_delivery_ceiling_fk FOREIGN KEY (delivery_ceiling_id) REFERENCES public.delivery_ceiling(id) ON DELETE CASCADE;


--
-- Name: public_delivery_plan_line public_delivery_plan_line_ceiling_line_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_delivery_plan_line
    ADD CONSTRAINT public_delivery_plan_line_ceiling_line_fk FOREIGN KEY (delivery_ceiling_line_id) REFERENCES public.delivery_ceiling_line(id) ON DELETE RESTRICT;


--
-- Name: public_delivery_plan_line public_delivery_plan_line_plan_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_delivery_plan_line
    ADD CONSTRAINT public_delivery_plan_line_plan_fk FOREIGN KEY (public_delivery_plan_id) REFERENCES public.public_delivery_plan(id) ON DELETE CASCADE;


--
-- Name: public_delivery_plan public_delivery_plan_updated_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_delivery_plan
    ADD CONSTRAINT public_delivery_plan_updated_by_fk FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: purchase_corrections purchase_corrections_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_corrections
    ADD CONSTRAINT purchase_corrections_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: request_approvals request_approvals_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_approvals
    ADD CONSTRAINT request_approvals_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id);


--
-- Name: request_approvals request_approvals_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_approvals
    ADD CONSTRAINT request_approvals_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id);


--
-- Name: request_attachments request_attachments_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_attachments
    ADD CONSTRAINT request_attachments_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id);


--
-- Name: request_attachments request_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_attachments
    ADD CONSTRAINT request_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: request_status_history request_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_status_history
    ADD CONSTRAINT request_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: request_status_history request_status_history_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_status_history
    ADD CONSTRAINT request_status_history_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE CASCADE;


--
-- Name: request_versions request_versions_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_versions
    ADD CONSTRAINT request_versions_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id);


--
-- Name: requests requests_origin_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_origin_department_id_fkey FOREIGN KEY (origin_department_id) REFERENCES public.departments(id);


--
-- Name: requests requests_request_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_request_type_id_fkey FOREIGN KEY (request_type_id) REFERENCES public.request_types(id) ON DELETE CASCADE;


--
-- Name: requests requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id);


--
-- Name: scheduled_visits scheduled_visits_client_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_visits
    ADD CONSTRAINT scheduled_visits_client_request_id_fkey FOREIGN KEY (client_request_id) REFERENCES public.client_requests(id) ON DELETE CASCADE;


--
-- Name: scheduled_visits scheduled_visits_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_visits
    ADD CONSTRAINT scheduled_visits_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES crm.crm_leads(id);


--
-- Name: scheduled_visits scheduled_visits_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_visits
    ADD CONSTRAINT scheduled_visits_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.visit_schedules(id) ON DELETE CASCADE;


--
-- Name: signature_workflow_artifacts signature_workflow_artifacts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_workflow_artifacts
    ADD CONSTRAINT signature_workflow_artifacts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: signature_workflow_artifacts signature_workflow_artifacts_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_workflow_artifacts
    ADD CONSTRAINT signature_workflow_artifacts_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.signature_workflow_documents(id) ON DELETE CASCADE;


--
-- Name: signature_workflow_artifacts signature_workflow_artifacts_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_workflow_artifacts
    ADD CONSTRAINT signature_workflow_artifacts_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.signature_workflows(id) ON DELETE CASCADE;


--
-- Name: signature_workflow_documents signature_workflow_documents_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_workflow_documents
    ADD CONSTRAINT signature_workflow_documents_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.signature_workflows(id) ON DELETE CASCADE;


--
-- Name: signature_workflow_events signature_workflow_events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_workflow_events
    ADD CONSTRAINT signature_workflow_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: signature_workflow_events signature_workflow_events_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_workflow_events
    ADD CONSTRAINT signature_workflow_events_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.signature_workflow_documents(id) ON DELETE SET NULL;


--
-- Name: signature_workflow_events signature_workflow_events_signer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_workflow_events
    ADD CONSTRAINT signature_workflow_events_signer_id_fkey FOREIGN KEY (signer_id) REFERENCES public.signature_workflow_signers(id) ON DELETE SET NULL;


--
-- Name: signature_workflow_events signature_workflow_events_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_workflow_events
    ADD CONSTRAINT signature_workflow_events_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.signature_workflows(id) ON DELETE CASCADE;


--
-- Name: signature_workflow_notifications signature_workflow_notifications_signer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_workflow_notifications
    ADD CONSTRAINT signature_workflow_notifications_signer_id_fkey FOREIGN KEY (signer_id) REFERENCES public.signature_workflow_signers(id) ON DELETE CASCADE;


--
-- Name: signature_workflow_notifications signature_workflow_notifications_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_workflow_notifications
    ADD CONSTRAINT signature_workflow_notifications_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.signature_workflows(id) ON DELETE CASCADE;


--
-- Name: signature_workflow_signers signature_workflow_signers_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_workflow_signers
    ADD CONSTRAINT signature_workflow_signers_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.signature_workflow_documents(id) ON DELETE CASCADE;


--
-- Name: signature_workflow_signers signature_workflow_signers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_workflow_signers
    ADD CONSTRAINT signature_workflow_signers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: signature_workflow_signers signature_workflow_signers_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_workflow_signers
    ADD CONSTRAINT signature_workflow_signers_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.signature_workflows(id) ON DELETE CASCADE;


--
-- Name: signature_workflows signature_workflows_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_workflows
    ADD CONSTRAINT signature_workflows_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: support_ticket_attachments support_ticket_attachments_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_attachments
    ADD CONSTRAINT support_ticket_attachments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: support_ticket_attachments support_ticket_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_attachments
    ADD CONSTRAINT support_ticket_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: support_ticket_comments support_ticket_comments_author_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_comments
    ADD CONSTRAINT support_ticket_comments_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: support_ticket_comments support_ticket_comments_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_comments
    ADD CONSTRAINT support_ticket_comments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: support_ticket_events support_ticket_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_events
    ADD CONSTRAINT support_ticket_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: support_ticket_events support_ticket_events_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_events
    ADD CONSTRAINT support_ticket_events_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: support_tickets support_tickets_assigned_ti_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_assigned_ti_user_id_fkey FOREIGN KEY (assigned_ti_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: technical_documents technical_documents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technical_documents
    ADD CONSTRAINT technical_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: ti_asset_accessories ti_asset_accessories_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_accessories
    ADD CONSTRAINT ti_asset_accessories_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.ti_assets(id) ON DELETE CASCADE;


--
-- Name: ti_asset_accessories ti_asset_accessories_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_accessories
    ADD CONSTRAINT ti_asset_accessories_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ti_asset_accessories ti_asset_accessories_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_accessories
    ADD CONSTRAINT ti_asset_accessories_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ti_asset_actas ti_asset_actas_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_actas
    ADD CONSTRAINT ti_asset_actas_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.ti_assets(id) ON DELETE CASCADE;


--
-- Name: ti_asset_actas ti_asset_actas_generated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_actas
    ADD CONSTRAINT ti_asset_actas_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ti_asset_actas_items ti_asset_actas_items_accessory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_actas_items
    ADD CONSTRAINT ti_asset_actas_items_accessory_id_fkey FOREIGN KEY (accessory_id) REFERENCES public.ti_asset_accessories(id) ON DELETE SET NULL;


--
-- Name: ti_asset_actas_items ti_asset_actas_items_acta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_actas_items
    ADD CONSTRAINT ti_asset_actas_items_acta_id_fkey FOREIGN KEY (acta_id) REFERENCES public.ti_asset_actas(id) ON DELETE CASCADE;


--
-- Name: ti_asset_actas_items ti_asset_actas_items_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_actas_items
    ADD CONSTRAINT ti_asset_actas_items_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.ti_assets(id) ON DELETE SET NULL;


--
-- Name: ti_asset_actas ti_asset_actas_previous_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_actas
    ADD CONSTRAINT ti_asset_actas_previous_user_id_fkey FOREIGN KEY (previous_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ti_asset_actas ti_asset_actas_recipient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_actas
    ADD CONSTRAINT ti_asset_actas_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ti_asset_actas ti_asset_actas_signature_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_actas
    ADD CONSTRAINT ti_asset_actas_signature_workflow_id_fkey FOREIGN KEY (signature_workflow_id) REFERENCES public.signature_workflows(id) ON DELETE SET NULL;


--
-- Name: ti_asset_actas ti_asset_actas_signed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_actas
    ADD CONSTRAINT ti_asset_actas_signed_by_fkey FOREIGN KEY (signed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ti_asset_assignments ti_asset_assignments_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_assignments
    ADD CONSTRAINT ti_asset_assignments_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.ti_assets(id) ON DELETE CASCADE;


--
-- Name: ti_asset_assignments ti_asset_assignments_assigned_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_assignments
    ADD CONSTRAINT ti_asset_assignments_assigned_to_user_id_fkey FOREIGN KEY (assigned_to_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ti_asset_assignments ti_asset_assignments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_assignments
    ADD CONSTRAINT ti_asset_assignments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ti_asset_assignments ti_asset_assignments_previous_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_assignments
    ADD CONSTRAINT ti_asset_assignments_previous_user_id_fkey FOREIGN KEY (previous_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ti_asset_events ti_asset_events_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_events
    ADD CONSTRAINT ti_asset_events_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.ti_assets(id) ON DELETE CASCADE;


--
-- Name: ti_asset_events ti_asset_events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_events
    ADD CONSTRAINT ti_asset_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ti_asset_financial_docs ti_asset_financial_docs_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_financial_docs
    ADD CONSTRAINT ti_asset_financial_docs_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.ti_assets(id) ON DELETE CASCADE;


--
-- Name: ti_asset_financial_docs ti_asset_financial_docs_assigned_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_financial_docs
    ADD CONSTRAINT ti_asset_financial_docs_assigned_user_id_fkey FOREIGN KEY (assigned_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ti_asset_financial_docs ti_asset_financial_docs_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_financial_docs
    ADD CONSTRAINT ti_asset_financial_docs_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.ti_asset_assignments(id) ON DELETE SET NULL;


--
-- Name: ti_asset_financial_docs ti_asset_financial_docs_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_financial_docs
    ADD CONSTRAINT ti_asset_financial_docs_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ti_asset_liberation_photos ti_asset_liberation_photos_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_liberation_photos
    ADD CONSTRAINT ti_asset_liberation_photos_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.ti_assets(id) ON DELETE CASCADE;


--
-- Name: ti_asset_liberation_photos ti_asset_liberation_photos_liberated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_liberation_photos
    ADD CONSTRAINT ti_asset_liberation_photos_liberated_by_fkey FOREIGN KEY (liberated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ti_asset_maintenance_schedule ti_asset_maintenance_schedule_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_maintenance_schedule
    ADD CONSTRAINT ti_asset_maintenance_schedule_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.ti_assets(id) ON DELETE CASCADE;


--
-- Name: ti_asset_maintenance_schedule ti_asset_maintenance_schedule_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_maintenance_schedule
    ADD CONSTRAINT ti_asset_maintenance_schedule_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ti_asset_maintenance_schedule ti_asset_maintenance_schedule_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_asset_maintenance_schedule
    ADD CONSTRAINT ti_asset_maintenance_schedule_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ti_assets ti_assets_assigned_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_assets
    ADD CONSTRAINT ti_assets_assigned_to_user_id_fkey FOREIGN KEY (assigned_to_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ti_assets ti_assets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_assets
    ADD CONSTRAINT ti_assets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ti_assets ti_assets_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_assets
    ADD CONSTRAINT ti_assets_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ti_corporate_number_history ti_corporate_number_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_corporate_number_history
    ADD CONSTRAINT ti_corporate_number_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ti_corporate_number_history ti_corporate_number_history_number_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_corporate_number_history
    ADD CONSTRAINT ti_corporate_number_history_number_id_fkey FOREIGN KEY (number_id) REFERENCES public.ti_corporate_numbers(id) ON DELETE CASCADE;


--
-- Name: ti_corporate_numbers ti_corporate_numbers_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_corporate_numbers
    ADD CONSTRAINT ti_corporate_numbers_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.ti_assets(id) ON DELETE SET NULL;


--
-- Name: ti_corporate_numbers ti_corporate_numbers_assigned_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_corporate_numbers
    ADD CONSTRAINT ti_corporate_numbers_assigned_to_user_id_fkey FOREIGN KEY (assigned_to_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ti_maintenance_reports ti_maintenance_reports_generated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ti_maintenance_reports
    ADD CONSTRAINT ti_maintenance_reports_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: training_attendees training_attendees_training_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_attendees
    ADD CONSTRAINT training_attendees_training_id_fkey FOREIGN KEY (training_id) REFERENCES public.trainings(id) ON DELETE CASCADE;


--
-- Name: trainings trainings_absent_manual_signed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainings
    ADD CONSTRAINT trainings_absent_manual_signed_by_user_id_fkey FOREIGN KEY (absent_manual_signed_by_user_id) REFERENCES public.users(id);


--
-- Name: trainings trainings_absent_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainings
    ADD CONSTRAINT trainings_absent_workflow_id_fkey FOREIGN KEY (absent_workflow_id) REFERENCES public.signature_workflows(id);


--
-- Name: trainings trainings_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainings
    ADD CONSTRAINT trainings_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: trainings trainings_manual_signed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainings
    ADD CONSTRAINT trainings_manual_signed_by_user_id_fkey FOREIGN KEY (manual_signed_by_user_id) REFERENCES public.users(id);


--
-- Name: trainings trainings_signature_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainings
    ADD CONSTRAINT trainings_signature_workflow_id_fkey FOREIGN KEY (signature_workflow_id) REFERENCES public.signature_workflows(id);


--
-- Name: trainings trainings_trainer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainings
    ADD CONSTRAINT trainings_trainer_user_id_fkey FOREIGN KEY (trainer_user_id) REFERENCES public.users(id);


--
-- Name: travel_allowance_documents travel_allowance_documents_allowance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_documents
    ADD CONSTRAINT travel_allowance_documents_allowance_id_fkey FOREIGN KEY (allowance_id) REFERENCES public.travel_allowances(id) ON DELETE CASCADE;


--
-- Name: travel_allowance_documents travel_allowance_documents_uploaded_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_documents
    ADD CONSTRAINT travel_allowance_documents_uploaded_by_user_id_fkey FOREIGN KEY (uploaded_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: travel_allowance_fixed_profiles travel_allowance_fixed_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_fixed_profiles
    ADD CONSTRAINT travel_allowance_fixed_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: travel_allowance_fixed_profiles travel_allowance_fixed_profiles_zona_cubierta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_fixed_profiles
    ADD CONSTRAINT travel_allowance_fixed_profiles_zona_cubierta_id_fkey FOREIGN KEY (zona_cubierta_id) REFERENCES public.travel_allowance_zones(id) ON DELETE SET NULL;


--
-- Name: travel_allowance_invoices travel_allowance_invoices_allowance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_invoices
    ADD CONSTRAINT travel_allowance_invoices_allowance_id_fkey FOREIGN KEY (allowance_id) REFERENCES public.travel_allowances(id) ON DELETE CASCADE;


--
-- Name: travel_allowance_invoices travel_allowance_invoices_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_invoices
    ADD CONSTRAINT travel_allowance_invoices_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: travel_allowance_invoices travel_allowance_invoices_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_invoices
    ADD CONSTRAINT travel_allowance_invoices_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.travel_allowance_documents(id) ON DELETE SET NULL;


--
-- Name: travel_allowance_invoices travel_allowance_invoices_drive_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_invoices
    ADD CONSTRAINT travel_allowance_invoices_drive_file_id_fkey FOREIGN KEY (drive_file_id) REFERENCES public.travel_allowance_documents(id) ON DELETE SET NULL;


--
-- Name: travel_allowance_invoices travel_allowance_invoices_duplicated_with_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_invoices
    ADD CONSTRAINT travel_allowance_invoices_duplicated_with_invoice_id_fkey FOREIGN KEY (duplicated_with_invoice_id) REFERENCES public.travel_allowance_invoices(id) ON DELETE SET NULL;


--
-- Name: travel_allowance_invoices travel_allowance_invoices_rejected_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_invoices
    ADD CONSTRAINT travel_allowance_invoices_rejected_by_user_id_fkey FOREIGN KEY (rejected_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: travel_allowance_invoices travel_allowance_invoices_returned_to_draft_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_invoices
    ADD CONSTRAINT travel_allowance_invoices_returned_to_draft_by_user_id_fkey FOREIGN KEY (returned_to_draft_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: travel_allowance_policy travel_allowance_policy_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_policy
    ADD CONSTRAINT travel_allowance_policy_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: travel_allowance_purchases_no_invoice travel_allowance_purchases_no_invoice_allowance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_purchases_no_invoice
    ADD CONSTRAINT travel_allowance_purchases_no_invoice_allowance_id_fkey FOREIGN KEY (allowance_id) REFERENCES public.travel_allowances(id) ON DELETE CASCADE;


--
-- Name: travel_allowance_purchases_no_invoice travel_allowance_purchases_no_invoice_approved_by_finance_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_purchases_no_invoice
    ADD CONSTRAINT travel_allowance_purchases_no_invoice_approved_by_finance_fkey FOREIGN KEY (approved_by_finance) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: travel_allowance_purchases_no_invoice travel_allowance_purchases_no_invoice_approved_by_talento_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_purchases_no_invoice
    ADD CONSTRAINT travel_allowance_purchases_no_invoice_approved_by_talento_fkey FOREIGN KEY (approved_by_talento) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: travel_allowance_purchases_no_invoice travel_allowance_purchases_no_invoice_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_purchases_no_invoice
    ADD CONSTRAINT travel_allowance_purchases_no_invoice_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.travel_allowance_documents(id) ON DELETE SET NULL;


--
-- Name: travel_allowance_purchases_no_invoice travel_allowance_purchases_no_invoice_rejected_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_purchases_no_invoice
    ADD CONSTRAINT travel_allowance_purchases_no_invoice_rejected_by_user_id_fkey FOREIGN KEY (rejected_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: travel_allowance_purchases_no_invoice travel_allowance_purchases_no_returned_to_draft_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_purchases_no_invoice
    ADD CONSTRAINT travel_allowance_purchases_no_returned_to_draft_by_user_id_fkey FOREIGN KEY (returned_to_draft_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: travel_allowance_segment_events travel_allowance_segment_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_segment_events
    ADD CONSTRAINT travel_allowance_segment_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: travel_allowance_segment_events travel_allowance_segment_events_allowance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_segment_events
    ADD CONSTRAINT travel_allowance_segment_events_allowance_id_fkey FOREIGN KEY (allowance_id) REFERENCES public.travel_allowances(id) ON DELETE CASCADE;


--
-- Name: travel_allowance_segment_events travel_allowance_segment_events_segment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_segment_events
    ADD CONSTRAINT travel_allowance_segment_events_segment_id_fkey FOREIGN KEY (segment_id) REFERENCES public.travel_allowance_segments(id) ON DELETE CASCADE;


--
-- Name: travel_allowance_segments travel_allowance_segments_allowance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_segments
    ADD CONSTRAINT travel_allowance_segments_allowance_id_fkey FOREIGN KEY (allowance_id) REFERENCES public.travel_allowances(id) ON DELETE CASCADE;


--
-- Name: travel_allowance_segments travel_allowance_segments_approved_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_segments
    ADD CONSTRAINT travel_allowance_segments_approved_by_user_id_fkey FOREIGN KEY (approved_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: travel_allowance_segments travel_allowance_segments_liquidated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_segments
    ADD CONSTRAINT travel_allowance_segments_liquidated_by_user_id_fkey FOREIGN KEY (liquidated_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: travel_allowance_segments travel_allowance_segments_rejected_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_segments
    ADD CONSTRAINT travel_allowance_segments_rejected_by_user_id_fkey FOREIGN KEY (rejected_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: travel_allowance_segments travel_allowance_segments_reviewed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_segments
    ADD CONSTRAINT travel_allowance_segments_reviewed_by_user_id_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: travel_allowance_segments travel_allowance_segments_submitted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_segments
    ADD CONSTRAINT travel_allowance_segments_submitted_by_user_id_fkey FOREIGN KEY (submitted_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: travel_allowance_sri_credentials travel_allowance_sri_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowance_sri_credentials
    ADD CONSTRAINT travel_allowance_sri_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: travel_allowances travel_allowances_finance_approved_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowances
    ADD CONSTRAINT travel_allowances_finance_approved_by_user_id_fkey FOREIGN KEY (finance_approved_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: travel_allowances travel_allowances_finance_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowances
    ADD CONSTRAINT travel_allowances_finance_user_id_fkey FOREIGN KEY (finance_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: travel_allowances travel_allowances_payment_receipt_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowances
    ADD CONSTRAINT travel_allowances_payment_receipt_uploaded_by_fkey FOREIGN KEY (payment_receipt_uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: travel_allowances travel_allowances_requester_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowances
    ADD CONSTRAINT travel_allowances_requester_user_id_fkey FOREIGN KEY (requester_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: travel_allowances travel_allowances_reviewed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowances
    ADD CONSTRAINT travel_allowances_reviewed_by_user_id_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: travel_allowances travel_allowances_reviewer_observation_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowances
    ADD CONSTRAINT travel_allowances_reviewer_observation_by_fkey FOREIGN KEY (reviewer_observation_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: travel_allowances travel_allowances_talento_approved_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_allowances
    ADD CONSTRAINT travel_allowances_talento_approved_by_user_id_fkey FOREIGN KEY (talento_approved_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: travel_segments travel_segments_from_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_segments
    ADD CONSTRAINT travel_segments_from_client_id_fkey FOREIGN KEY (from_client_id) REFERENCES public.client_requests(id) ON DELETE SET NULL;


--
-- Name: travel_segments travel_segments_to_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_segments
    ADD CONSTRAINT travel_segments_to_client_id_fkey FOREIGN KEY (to_client_id) REFERENCES public.client_requests(id) ON DELETE SET NULL;


--
-- Name: user_attendance_records user_attendance_records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_attendance_records
    ADD CONSTRAINT user_attendance_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_certifications user_certifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_certifications
    ADD CONSTRAINT user_certifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_module_access user_module_access_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_module_access
    ADD CONSTRAINT user_module_access_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_module_access user_module_access_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_module_access
    ADD CONSTRAINT user_module_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_profile user_profile_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profile
    ADD CONSTRAINT user_profile_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_offboarding_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_offboarding_requested_by_fkey FOREIGN KEY (offboarding_requested_by) REFERENCES public.users(id);


--
-- Name: vacaciones_solicitudes_firmas vacaciones_solicitudes_firmas_signer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vacaciones_solicitudes_firmas
    ADD CONSTRAINT vacaciones_solicitudes_firmas_signer_user_id_fkey FOREIGN KEY (signer_user_id) REFERENCES public.users(id);


--
-- Name: vacaciones_solicitudes_firmas vacaciones_solicitudes_firmas_solicitud_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vacaciones_solicitudes_firmas
    ADD CONSTRAINT vacaciones_solicitudes_firmas_solicitud_id_fkey FOREIGN KEY (solicitud_id) REFERENCES public.vacaciones_solicitudes(id) ON DELETE CASCADE;


--
-- Name: viatico_anticipos viatico_anticipos_allowance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.viatico_anticipos
    ADD CONSTRAINT viatico_anticipos_allowance_id_fkey FOREIGN KEY (allowance_id) REFERENCES public.travel_allowances(id) ON DELETE CASCADE;


--
-- Name: viatico_anticipos viatico_anticipos_approved_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.viatico_anticipos
    ADD CONSTRAINT viatico_anticipos_approved_by_user_id_fkey FOREIGN KEY (approved_by_user_id) REFERENCES public.users(id);


--
-- Name: viatico_anticipos viatico_anticipos_payment_receipt_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.viatico_anticipos
    ADD CONSTRAINT viatico_anticipos_payment_receipt_uploaded_by_fkey FOREIGN KEY (payment_receipt_uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: viatico_anticipos viatico_anticipos_requested_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.viatico_anticipos
    ADD CONSTRAINT viatico_anticipos_requested_by_user_id_fkey FOREIGN KEY (requested_by_user_id) REFERENCES public.users(id);


--
-- Name: corrective_case_comments corrective_case_comments_author_user_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.corrective_case_comments
    ADD CONSTRAINT corrective_case_comments_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: corrective_case_comments corrective_case_comments_case_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.corrective_case_comments
    ADD CONSTRAINT corrective_case_comments_case_id_fkey FOREIGN KEY (case_id) REFERENCES servicio.corrective_cases(id) ON DELETE CASCADE;


--
-- Name: corrective_case_events corrective_case_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.corrective_case_events
    ADD CONSTRAINT corrective_case_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: corrective_case_events corrective_case_events_case_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.corrective_case_events
    ADD CONSTRAINT corrective_case_events_case_id_fkey FOREIGN KEY (case_id) REFERENCES servicio.corrective_cases(id) ON DELETE CASCADE;


--
-- Name: corrective_case_evidences corrective_case_evidences_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.corrective_case_evidences
    ADD CONSTRAINT corrective_case_evidences_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: corrective_case_evidences corrective_case_evidences_case_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.corrective_case_evidences
    ADD CONSTRAINT corrective_case_evidences_case_id_fkey FOREIGN KEY (case_id) REFERENCES servicio.corrective_cases(id) ON DELETE CASCADE;


--
-- Name: corrective_case_spare_parts corrective_case_spare_parts_case_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.corrective_case_spare_parts
    ADD CONSTRAINT corrective_case_spare_parts_case_id_fkey FOREIGN KEY (case_id) REFERENCES servicio.corrective_cases(id) ON DELETE CASCADE;


--
-- Name: corrective_case_spare_parts corrective_case_spare_parts_created_by_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.corrective_case_spare_parts
    ADD CONSTRAINT corrective_case_spare_parts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: corrective_cases corrective_cases_assigned_specialist_user_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.corrective_cases
    ADD CONSTRAINT corrective_cases_assigned_specialist_user_id_fkey FOREIGN KEY (assigned_specialist_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: corrective_cases corrective_cases_closed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.corrective_cases
    ADD CONSTRAINT corrective_cases_closed_by_user_id_fkey FOREIGN KEY (closed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: corrective_cases corrective_cases_dispatcher_user_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.corrective_cases
    ADD CONSTRAINT corrective_cases_dispatcher_user_id_fkey FOREIGN KEY (dispatcher_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: corrective_cases corrective_cases_requester_user_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.corrective_cases
    ADD CONSTRAINT corrective_cases_requester_user_id_fkey FOREIGN KEY (requester_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: cronograma_actividades_tecnicas cronograma_actividades_tecnicas_created_by_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.cronograma_actividades_tecnicas
    ADD CONSTRAINT cronograma_actividades_tecnicas_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: cronograma_actividades_tecnicas cronograma_actividades_tecnicas_user_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.cronograma_actividades_tecnicas
    ADD CONSTRAINT cronograma_actividades_tecnicas_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: cronograma_mantenimientos_anuales cronograma_mantenimientos_anuales_id_equipo_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos_anuales
    ADD CONSTRAINT cronograma_mantenimientos_anuales_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES servicio.equipos(id_equipo) ON DELETE CASCADE;


--
-- Name: cronograma_mantenimientos cronograma_mantenimientos_created_by_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos
    ADD CONSTRAINT cronograma_mantenimientos_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: cronograma_mantenimientos cronograma_mantenimientos_id_equipo_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos
    ADD CONSTRAINT cronograma_mantenimientos_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES servicio.equipos(id_equipo) ON DELETE CASCADE;


--
-- Name: cronograma_mantenimientos cronograma_mantenimientos_request_fk; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.cronograma_mantenimientos
    ADD CONSTRAINT cronograma_mantenimientos_request_fk FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE SET NULL;


--
-- Name: disponibilidad_tecnicos disponibilidad_tecnicos_user_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.disponibilidad_tecnicos
    ADD CONSTRAINT disponibilidad_tecnicos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: equipos equipos_created_by_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.equipos
    ADD CONSTRAINT equipos_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: equipos equipos_updated_by_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.equipos
    ADD CONSTRAINT equipos_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: external_case_events external_case_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.external_case_events
    ADD CONSTRAINT external_case_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: external_case_events external_case_events_external_case_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.external_case_events
    ADD CONSTRAINT external_case_events_external_case_id_fkey FOREIGN KEY (external_case_id) REFERENCES servicio.external_cases(id) ON DELETE CASCADE;


--
-- Name: external_case_sync_jobs external_case_sync_jobs_external_case_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.external_case_sync_jobs
    ADD CONSTRAINT external_case_sync_jobs_external_case_id_fkey FOREIGN KEY (external_case_id) REFERENCES servicio.external_cases(id) ON DELETE CASCADE;


--
-- Name: external_cases external_cases_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.external_cases
    ADD CONSTRAINT external_cases_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: external_cases external_cases_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.external_cases
    ADD CONSTRAINT external_cases_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: external_provider_identities external_provider_identities_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.external_provider_identities
    ADD CONSTRAINT external_provider_identities_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: external_provider_identities external_provider_identities_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.external_provider_identities
    ADD CONSTRAINT external_provider_identities_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: preventive_annual_plans preventive_annual_plans_baseline_of_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_annual_plans
    ADD CONSTRAINT preventive_annual_plans_baseline_of_id_fkey FOREIGN KEY (baseline_of_id) REFERENCES servicio.preventive_annual_plans(id) ON DELETE SET NULL;


--
-- Name: preventive_annual_plans preventive_annual_plans_created_by_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_annual_plans
    ADD CONSTRAINT preventive_annual_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: preventive_case_events preventive_case_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_case_events
    ADD CONSTRAINT preventive_case_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: preventive_case_events preventive_case_events_annual_plan_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_case_events
    ADD CONSTRAINT preventive_case_events_annual_plan_id_fkey FOREIGN KEY (annual_plan_id) REFERENCES servicio.preventive_annual_plans(id) ON DELETE CASCADE;


--
-- Name: preventive_case_events preventive_case_events_plan_item_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_case_events
    ADD CONSTRAINT preventive_case_events_plan_item_id_fkey FOREIGN KEY (plan_item_id) REFERENCES servicio.preventive_plan_items(id) ON DELETE CASCADE;


--
-- Name: preventive_documents preventive_documents_annual_plan_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_documents
    ADD CONSTRAINT preventive_documents_annual_plan_id_fkey FOREIGN KEY (annual_plan_id) REFERENCES servicio.preventive_annual_plans(id) ON DELETE CASCADE;


--
-- Name: preventive_documents preventive_documents_created_by_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_documents
    ADD CONSTRAINT preventive_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: preventive_documents preventive_documents_plan_item_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_documents
    ADD CONSTRAINT preventive_documents_plan_item_id_fkey FOREIGN KEY (plan_item_id) REFERENCES servicio.preventive_plan_items(id) ON DELETE CASCADE;


--
-- Name: preventive_execution_reports preventive_execution_reports_performed_by_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_execution_reports
    ADD CONSTRAINT preventive_execution_reports_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: preventive_execution_reports preventive_execution_reports_plan_item_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_execution_reports
    ADD CONSTRAINT preventive_execution_reports_plan_item_id_fkey FOREIGN KEY (plan_item_id) REFERENCES servicio.preventive_plan_items(id) ON DELETE CASCADE;


--
-- Name: preventive_kit_requests preventive_kit_requests_created_by_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_kit_requests
    ADD CONSTRAINT preventive_kit_requests_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: preventive_kit_requests preventive_kit_requests_plan_item_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_kit_requests
    ADD CONSTRAINT preventive_kit_requests_plan_item_id_fkey FOREIGN KEY (plan_item_id) REFERENCES servicio.preventive_plan_items(id) ON DELETE CASCADE;


--
-- Name: preventive_offers preventive_offers_created_by_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_offers
    ADD CONSTRAINT preventive_offers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: preventive_offers preventive_offers_decided_by_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_offers
    ADD CONSTRAINT preventive_offers_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: preventive_offers preventive_offers_plan_item_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_offers
    ADD CONSTRAINT preventive_offers_plan_item_id_fkey FOREIGN KEY (plan_item_id) REFERENCES servicio.preventive_plan_items(id) ON DELETE CASCADE;


--
-- Name: preventive_plan_items preventive_plan_items_annual_plan_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_plan_items
    ADD CONSTRAINT preventive_plan_items_annual_plan_id_fkey FOREIGN KEY (annual_plan_id) REFERENCES servicio.preventive_annual_plans(id) ON DELETE CASCADE;


--
-- Name: preventive_plan_items preventive_plan_items_coordinated_by_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_plan_items
    ADD CONSTRAINT preventive_plan_items_coordinated_by_fkey FOREIGN KEY (coordinated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: preventive_reprogramming_notices preventive_reprogramming_notices_created_by_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_reprogramming_notices
    ADD CONSTRAINT preventive_reprogramming_notices_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: preventive_reprogramming_notices preventive_reprogramming_notices_plan_item_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.preventive_reprogramming_notices
    ADD CONSTRAINT preventive_reprogramming_notices_plan_item_id_fkey FOREIGN KEY (plan_item_id) REFERENCES servicio.preventive_plan_items(id) ON DELETE CASCADE;


--
-- Name: withdrawal_packaging_labels withdrawal_packaging_labels_created_by_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.withdrawal_packaging_labels
    ADD CONSTRAINT withdrawal_packaging_labels_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: withdrawal_packaging_labels withdrawal_packaging_labels_workflow_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.withdrawal_packaging_labels
    ADD CONSTRAINT withdrawal_packaging_labels_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES servicio.withdrawal_workflows(id) ON DELETE CASCADE;


--
-- Name: withdrawal_workflows withdrawal_workflows_created_by_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.withdrawal_workflows
    ADD CONSTRAINT withdrawal_workflows_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workflow_audit_events workflow_audit_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.workflow_audit_events
    ADD CONSTRAINT workflow_audit_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workflows workflows_created_by_fkey; Type: FK CONSTRAINT; Schema: servicio; Owner: -
--

ALTER TABLE ONLY servicio.workflows
    ADD CONSTRAINT workflows_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attachments attachments_created_by_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.attachments
    ADD CONSTRAINT attachments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: attachments attachments_item_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.attachments
    ADD CONSTRAINT attachments_item_id_fkey FOREIGN KEY (item_id) REFERENCES work_management.items(id) ON DELETE CASCADE;


--
-- Name: board_groups board_groups_board_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.board_groups
    ADD CONSTRAINT board_groups_board_id_fkey FOREIGN KEY (board_id) REFERENCES work_management.boards(id) ON DELETE CASCADE;


--
-- Name: board_groups board_groups_created_by_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.board_groups
    ADD CONSTRAINT board_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: board_groups board_groups_updated_by_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.board_groups
    ADD CONSTRAINT board_groups_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: boards boards_created_by_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.boards
    ADD CONSTRAINT boards_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: boards boards_project_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.boards
    ADD CONSTRAINT boards_project_id_fkey FOREIGN KEY (project_id) REFERENCES work_management.projects(id) ON DELETE CASCADE;


--
-- Name: boards boards_updated_by_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.boards
    ADD CONSTRAINT boards_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: checklist_items checklist_items_checklist_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.checklist_items
    ADD CONSTRAINT checklist_items_checklist_id_fkey FOREIGN KEY (checklist_id) REFERENCES work_management.checklists(id) ON DELETE CASCADE;


--
-- Name: checklist_items checklist_items_created_by_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.checklist_items
    ADD CONSTRAINT checklist_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: checklist_items checklist_items_done_by_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.checklist_items
    ADD CONSTRAINT checklist_items_done_by_fkey FOREIGN KEY (done_by) REFERENCES public.users(id);


--
-- Name: checklists checklists_created_by_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.checklists
    ADD CONSTRAINT checklists_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: checklists checklists_item_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.checklists
    ADD CONSTRAINT checklists_item_id_fkey FOREIGN KEY (item_id) REFERENCES work_management.items(id) ON DELETE CASCADE;


--
-- Name: comments comments_created_by_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.comments
    ADD CONSTRAINT comments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: comments comments_item_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.comments
    ADD CONSTRAINT comments_item_id_fkey FOREIGN KEY (item_id) REFERENCES work_management.items(id) ON DELETE CASCADE;


--
-- Name: comments comments_updated_by_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.comments
    ADD CONSTRAINT comments_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: followers followers_item_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.followers
    ADD CONSTRAINT followers_item_id_fkey FOREIGN KEY (item_id) REFERENCES work_management.items(id) ON DELETE CASCADE;


--
-- Name: followers followers_user_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.followers
    ADD CONSTRAINT followers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: item_assignees item_assignees_assigned_by_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.item_assignees
    ADD CONSTRAINT item_assignees_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: item_assignees item_assignees_item_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.item_assignees
    ADD CONSTRAINT item_assignees_item_id_fkey FOREIGN KEY (item_id) REFERENCES work_management.items(id) ON DELETE CASCADE;


--
-- Name: item_assignees item_assignees_user_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.item_assignees
    ADD CONSTRAINT item_assignees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: items items_board_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.items
    ADD CONSTRAINT items_board_id_fkey FOREIGN KEY (board_id) REFERENCES work_management.boards(id) ON DELETE SET NULL;


--
-- Name: items items_created_by_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.items
    ADD CONSTRAINT items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: items items_group_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.items
    ADD CONSTRAINT items_group_id_fkey FOREIGN KEY (group_id) REFERENCES work_management.board_groups(id) ON DELETE SET NULL;


--
-- Name: items items_parent_item_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.items
    ADD CONSTRAINT items_parent_item_id_fkey FOREIGN KEY (parent_item_id) REFERENCES work_management.items(id) ON DELETE CASCADE;


--
-- Name: items items_project_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.items
    ADD CONSTRAINT items_project_id_fkey FOREIGN KEY (project_id) REFERENCES work_management.projects(id) ON DELETE CASCADE;


--
-- Name: items items_scheduled_visit_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.items
    ADD CONSTRAINT items_scheduled_visit_id_fkey FOREIGN KEY (scheduled_visit_id) REFERENCES public.scheduled_visits(id) ON DELETE SET NULL;


--
-- Name: items items_updated_by_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.items
    ADD CONSTRAINT items_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: project_members project_members_created_by_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.project_members
    ADD CONSTRAINT project_members_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: project_members project_members_project_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.project_members
    ADD CONSTRAINT project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES work_management.projects(id) ON DELETE CASCADE;


--
-- Name: project_members project_members_user_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.project_members
    ADD CONSTRAINT project_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: projects projects_approved_by_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.projects
    ADD CONSTRAINT projects_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: projects projects_created_by_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.projects
    ADD CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: projects projects_crm_account_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.projects
    ADD CONSTRAINT projects_crm_account_id_fkey FOREIGN KEY (crm_account_id) REFERENCES crm.crm_accounts(id) ON DELETE SET NULL;


--
-- Name: projects projects_crm_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.projects
    ADD CONSTRAINT projects_crm_opportunity_id_fkey FOREIGN KEY (crm_opportunity_id) REFERENCES crm.crm_opportunities(id) ON DELETE SET NULL;


--
-- Name: projects projects_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.projects
    ADD CONSTRAINT projects_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id);


--
-- Name: projects projects_schedule_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.projects
    ADD CONSTRAINT projects_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.visit_schedules(id) ON DELETE SET NULL;


--
-- Name: projects projects_updated_by_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.projects
    ADD CONSTRAINT projects_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: projects projects_workspace_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.projects
    ADD CONSTRAINT projects_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES work_management.workspaces(id) ON DELETE CASCADE;


--
-- Name: spi_links spi_links_created_by_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.spi_links
    ADD CONSTRAINT spi_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: work_activity_log work_activity_log_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.work_activity_log
    ADD CONSTRAINT work_activity_log_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id);


--
-- Name: work_activity_log work_activity_log_board_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.work_activity_log
    ADD CONSTRAINT work_activity_log_board_id_fkey FOREIGN KEY (board_id) REFERENCES work_management.boards(id) ON DELETE CASCADE;


--
-- Name: work_activity_log work_activity_log_item_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.work_activity_log
    ADD CONSTRAINT work_activity_log_item_id_fkey FOREIGN KEY (item_id) REFERENCES work_management.items(id) ON DELETE CASCADE;


--
-- Name: work_activity_log work_activity_log_project_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.work_activity_log
    ADD CONSTRAINT work_activity_log_project_id_fkey FOREIGN KEY (project_id) REFERENCES work_management.projects(id) ON DELETE CASCADE;


--
-- Name: work_activity_log work_activity_log_workspace_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.work_activity_log
    ADD CONSTRAINT work_activity_log_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES work_management.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_members workspace_members_created_by_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.workspace_members
    ADD CONSTRAINT workspace_members_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: workspace_members workspace_members_user_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.workspace_members
    ADD CONSTRAINT workspace_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workspace_members workspace_members_workspace_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES work_management.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspaces workspaces_created_by_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.workspaces
    ADD CONSTRAINT workspaces_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: workspaces workspaces_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.workspaces
    ADD CONSTRAINT workspaces_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id);


--
-- Name: workspaces workspaces_updated_by_fkey; Type: FK CONSTRAINT; Schema: work_management; Owner: -
--

ALTER TABLE ONLY work_management.workspaces
    ADD CONSTRAINT workspaces_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 7xCByTrr8qvNElQCA5a3ccoxFkhi5DUCStaNY8AT06aaYaXILj7KpuRWQAysQKl

