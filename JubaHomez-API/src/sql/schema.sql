CREATE DATABASE IF NOT EXISTS jubahomez;
USE jubahomez;

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  role ENUM('customer','broker','owner','photographer','admin') NOT NULL,
  status ENUM('pending','active','rejected','blocked') NOT NULL DEFAULT 'pending',
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(30) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  bio VARCHAR(500) NULL,
  avatar_url VARCHAR(255) NULL,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- PROPERTIES
CREATE TABLE IF NOT EXISTS properties (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  price INT NOT NULL,
  type ENUM('sale','rent') NOT NULL,
  status ENUM('available','unavailable') NOT NULL DEFAULT 'available',
  approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  location VARCHAR(120) NOT NULL,
  area VARCHAR(120) NOT NULL,
  rooms INT NOT NULL,
  bathrooms INT NOT NULL DEFAULT 0,
  size INT NULL,
  address VARCHAR(255) NULL,
  owner_id BIGINT NULL,
  broker_id BIGINT NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_props_area(area),
  INDEX idx_props_location(location),
  INDEX idx_props_price(price),
  CONSTRAINT fk_props_owner FOREIGN KEY (owner_id) REFERENCES users(id),
  CONSTRAINT fk_props_broker FOREIGN KEY (broker_id) REFERENCES users(id)
);

-- INQUIRIES
CREATE TABLE IF NOT EXISTS inquiries (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  property_id BIGINT NOT NULL,
  recipient_user_id BIGINT NOT NULL,
  sender_user_id BIGINT NULL,
  sender_name VARCHAR(120) NOT NULL,
  sender_email VARCHAR(150) NOT NULL,
  sender_phone VARCHAR(30) NOT NULL,
  message TEXT NOT NULL,
  status ENUM('open','closed') NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_inq_prop FOREIGN KEY (property_id) REFERENCES properties(id),
  CONSTRAINT fk_inq_recipient FOREIGN KEY (recipient_user_id) REFERENCES users(id),
  CONSTRAINT fk_inq_sender FOREIGN KEY (sender_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS inquiry_replies (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  inquiry_id BIGINT NOT NULL,
  sender_user_id BIGINT NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_inqrep_inq FOREIGN KEY (inquiry_id) REFERENCES inquiries(id),
  CONSTRAINT fk_inqrep_sender FOREIGN KEY (sender_user_id) REFERENCES users(id)
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(120) NULL,
  message VARCHAR(1000) NULL,
  ref_type VARCHAR(50) NULL,
  ref_id BIGINT NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_user(user_id, read_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  actor_id BIGINT NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(50) NULL,
  entity_id BIGINT NULL,
  meta_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_actor(actor_id),
  INDEX idx_audit_action(action)
);

-- ANNOUNCEMENTS
CREATE TABLE IF NOT EXISTS announcements (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(120) NOT NULL,
  message TEXT NOT NULL,
  audience_json JSON NOT NULL,
  expires_at DATETIME NULL,
  created_by BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ann_created_by FOREIGN KEY (created_by) REFERENCES users(id)
);

-- PASSWORD RESETS (DEMO)
CREATE TABLE IF NOT EXISTS password_resets (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pr_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- MEDIA (photos/videos)
CREATE TABLE IF NOT EXISTS media (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  property_id BIGINT NOT NULL,
  uploaded_by BIGINT NOT NULL,
  kind ENUM('photo','video') NOT NULL,
  url VARCHAR(500) NOT NULL,
  thumb_url VARCHAR(500) NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT NOT NULL,
  approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_media_property(property_id, approval_status),
  CONSTRAINT fk_media_property FOREIGN KEY (property_id) REFERENCES properties(id),
  CONSTRAINT fk_media_user FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- VIEWING REQUESTS
CREATE TABLE IF NOT EXISTS viewing_requests (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  property_id BIGINT NOT NULL,
  recipient_user_id BIGINT NOT NULL,
  requester_user_id BIGINT NULL,
  requester_name VARCHAR(120) NOT NULL,
  requester_email VARCHAR(150) NOT NULL,
  requester_phone VARCHAR(30) NOT NULL,
  preferred_dates_json JSON NULL,
  message TEXT NULL,
  status ENUM('pending','accepted','rejected','cancelled') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_vr_property FOREIGN KEY (property_id) REFERENCES properties(id),
  CONSTRAINT fk_vr_recipient FOREIGN KEY (recipient_user_id) REFERENCES users(id),
  CONSTRAINT fk_vr_requester FOREIGN KEY (requester_user_id) REFERENCES users(id)
);

-- VIEWINGS
CREATE TABLE IF NOT EXISTS viewings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  request_id BIGINT NOT NULL,
  property_id BIGINT NOT NULL,
  recipient_user_id BIGINT NOT NULL,
  requester_user_id BIGINT NULL,
  scheduled_at DATETIME NOT NULL,
  location_note VARCHAR(255) NULL,
  agent_note VARCHAR(255) NULL,
  status ENUM('upcoming','completed','cancelled') NOT NULL DEFAULT 'upcoming',
  cancel_reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_viewings_recipient(recipient_user_id, scheduled_at),
  INDEX idx_viewings_property(property_id, scheduled_at),
  CONSTRAINT fk_viewings_req FOREIGN KEY (request_id) REFERENCES viewing_requests(id),
  CONSTRAINT fk_viewings_property FOREIGN KEY (property_id) REFERENCES properties(id),
  CONSTRAINT fk_viewings_recipient FOREIGN KEY (recipient_user_id) REFERENCES users(id),
  CONSTRAINT fk_viewings_requester FOREIGN KEY (requester_user_id) REFERENCES users(id)
);

-- PHOTO JOBS
CREATE TABLE IF NOT EXISTS photo_jobs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  property_id BIGINT NOT NULL,
  requested_by BIGINT NOT NULL,
  preferred_photographer_id BIGINT NULL,
  photographer_id BIGINT NULL,
  notes TEXT NULL,
  preferred_dates_json JSON NULL,
  scheduled_at DATETIME NULL,
  status ENUM('open','assigned','scheduled','rejected','completed','cancelled') NOT NULL DEFAULT 'open',
  reject_reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_photo_jobs_status(status),
  INDEX idx_photo_jobs_photographer(photographer_id, status),
  CONSTRAINT fk_pj_property FOREIGN KEY (property_id) REFERENCES properties(id),
  CONSTRAINT fk_pj_requested_by FOREIGN KEY (requested_by) REFERENCES users(id),
  CONSTRAINT fk_pj_pref FOREIGN KEY (preferred_photographer_id) REFERENCES users(id),
  CONSTRAINT fk_pj_photographer FOREIGN KEY (photographer_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS photo_job_messages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  job_id BIGINT NOT NULL,
  sender_user_id BIGINT NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pjm_job(job_id, created_at),
  CONSTRAINT fk_pjm_job FOREIGN KEY (job_id) REFERENCES photo_jobs(id),
  CONSTRAINT fk_pjm_sender FOREIGN KEY (sender_user_id) REFERENCES users(id)
);

-- ANALYTICS EVENTS
CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  type VARCHAR(60) NOT NULL,
  property_id BIGINT NULL,
  user_id BIGINT NULL,
  session_id VARCHAR(80) NULL,
  meta_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ae_type(type, created_at),
  INDEX idx_ae_property(property_id, created_at),
  CONSTRAINT fk_ae_property FOREIGN KEY (property_id) REFERENCES properties(id),
  CONSTRAINT fk_ae_user FOREIGN KEY (user_id) REFERENCES users(id)
);
