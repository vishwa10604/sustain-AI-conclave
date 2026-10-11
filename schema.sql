-- GreenOps Smart Fleet & Automotive Risk Microservice
-- Relational Database DDL Schema (H2 / PostgreSQL / MySQL compatible)

CREATE TABLE IF NOT EXISTS vehicles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    registration_number VARCHAR(64) NOT NULL UNIQUE,
    type VARCHAR(64) NOT NULL,
    fuel_type VARCHAR(32) NOT NULL,
    model_year INT NOT NULL,
    odometer_km INT NOT NULL,
    last_service_date DATE,
    model_name VARCHAR(128) NOT NULL,
    estimated_price DOUBLE PRECISION NOT NULL,
    safety_rating VARCHAR(64),
    fuel_efficiency_km_per_l DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS maintenance_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id BIGINT NOT NULL,
    service_date DATE,
    type VARCHAR(64) NOT NULL,
    description VARCHAR(1000),
    cost DOUBLE PRECISION NOT NULL,
    CONSTRAINT fk_record_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vehicle_health (
    vehicle_id BIGINT PRIMARY KEY,
    oil_level_percent DOUBLE PRECISION,
    oil_pressure_status VARCHAR(32),
    oil_condition VARCHAR(32),
    last_oil_change DATE,
    next_oil_change DATE,
    oil_maintenance_status VARCHAR(32),
    tire_pressure_fl_psi DOUBLE PRECISION,
    tire_pressure_fr_psi DOUBLE PRECISION,
    tire_pressure_rl_psi DOUBLE PRECISION,
    tire_pressure_rr_psi DOUBLE PRECISION,
    recommended_tire_pressure_psi DOUBLE PRECISION,
    tire_tread_fl_mm DOUBLE PRECISION,
    tire_tread_fr_mm DOUBLE PRECISION,
    tire_tread_rl_mm DOUBLE PRECISION,
    tire_tread_rr_mm DOUBLE PRECISION,
    tire_inspection_status VARCHAR(32),
    coolant_temp_celsius DOUBLE PRECISION,
    battery_health_percent DOUBLE PRECISION,
    battery_voltage DOUBLE PRECISION,
    brake_pad_front_percent DOUBLE PRECISION,
    brake_pad_rear_percent DOUBLE PRECISION,
    brake_fluid_status VARCHAR(32),
    diagnostic_trouble_codes VARCHAR(2000),
    fuel_efficiency_km_per_l DOUBLE PRECISION,
    odometer_km INT,
    overall_health_status VARCHAR(32),
    data_source VARCHAR(128),
    last_updated TIMESTAMP
);

CREATE TABLE IF NOT EXISTS priority_risk_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id BIGINT,
    vehicle_model VARCHAR(128),
    registration_number VARCHAR(64),
    risk_category VARCHAR(64),
    priority VARCHAR(16) NOT NULL,
    detected_issue VARCHAR(500),
    measured_value VARCHAR(128),
    expected_range VARCHAR(128),
    risk_score INT NOT NULL,
    reason VARCHAR(1000),
    recommended_action VARCHAR(1000),
    detected_date DATE,
    last_updated TIMESTAMP,
    status VARCHAR(32) NOT NULL DEFAULT 'Open'
);

CREATE TABLE IF NOT EXISTS customer_reviews (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id BIGINT,
    author VARCHAR(128) NOT NULL,
    rating INT NOT NULL,
    title VARCHAR(256),
    comment VARCHAR(2000),
    review_date DATE,
    sentiment VARCHAR(32),
    problem_tags VARCHAR(1000),
    praise_tags VARCHAR(1000),
    verified_purchase BOOLEAN DEFAULT TRUE,
    flagged_suspicious BOOLEAN DEFAULT FALSE,
    suspicious_reason VARCHAR(1000)
);

CREATE TABLE IF NOT EXISTS smart_notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id BIGINT,
    registration_number VARCHAR(64),
    priority VARCHAR(32) NOT NULL,
    title VARCHAR(256) NOT NULL,
    message VARCHAR(1000),
    timestamp TIMESTAMP,
    acknowledged BOOLEAN DEFAULT FALSE,
    status VARCHAR(32) DEFAULT 'Open'
);

CREATE TABLE IF NOT EXISTS user_accounts (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(128) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    password VARCHAR(256),
    role VARCHAR(32) NOT NULL,
    verified BOOLEAN DEFAULT TRUE,
    verification_doc VARCHAR(128),
    assigned_vehicle_reg VARCHAR(64),
    assigned_vehicle_id BIGINT
);

CREATE TABLE IF NOT EXISTS driver_inspections (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id BIGINT,
    driver_name VARCHAR(128) NOT NULL,
    vehicle_reg VARCHAR(64),
    tire_pressure_visual_ok BOOLEAN,
    oil_level_checked BOOLEAN,
    brakes_responsive BOOLEAN,
    lights_operational BOOLEAN,
    odometer_km INT,
    remarks VARCHAR(1000),
    timestamp TIMESTAMP,
    safety_verdict VARCHAR(64) DEFAULT 'CLEARED_FOR_ROUTE'
);
