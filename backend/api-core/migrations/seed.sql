-- Seed local — NO correr en producción
-- Hash bcrypt de "admin123" (cost=10)
INSERT INTO users (email, password_hash, role) VALUES
  ('admin@vm.dev',   '$2a$10$2BEr8EZpsLDneKRjyUgG6O4hwsMTM5bpnS5auB36kIVN3thttlepy', 'admin'),
  ('cliente@vm.dev', '$2a$10$2BEr8EZpsLDneKRjyUgG6O4hwsMTM5bpnS5auB36kIVN3thttlepy', 'cliente')
ON CONFLICT (email) DO NOTHING;

INSERT INTO vms (name, cores, ram_gb, disk_gb, os, status) VALUES
  ('prod-web-01',  4,  8,  100, 'Ubuntu 22.04',        'encendida'),
  ('staging-db-01', 2, 4,  50,  'Debian 12',            'apagada')
ON CONFLICT DO NOTHING;
