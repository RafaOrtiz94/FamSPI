-- Insert test certifications for user ID 1
INSERT INTO user_certifications (
  user_id, title, issuer, issue_date, expiry_date,
  credential_type, description, drive_file_id, file_url,
  metadata, created_at, updated_at
) VALUES
(1, 'Certificación AWS Solutions Architect', 'Amazon Web Services', '2023-05-15', '2026-05-15',
 'certification', 'Certificación profesional en arquitectura de soluciones AWS', 'test-pdf-1', 'https://example.com/cert1.pdf',
 '{}', NOW(), NOW()),

(1, 'Diplomado en Desarrollo Web Full Stack', 'Universidad Técnica Particular de Loja', '2022-12-01', NULL,
 'diploma', 'Diplomado completo en desarrollo web moderno', 'test-jpg-1', 'https://example.com/cert2.jpg',
 '{}', NOW(), NOW()),

(1, 'Curso React Advanced Patterns', 'Udemy', '2024-01-10', '2025-01-10',
 'course', 'Curso avanzado de patrones en React', 'test-png-1', 'https://example.com/cert3.png',
 '{}', NOW(), NOW());

-- Verify insertion
SELECT COUNT(*) FROM user_certifications;