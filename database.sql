-- =====================================================================
-- AAJ's Inventory Management System - database
-- Import this file in phpMyAdmin (Import tab).
-- =====================================================================

CREATE DATABASE IF NOT EXISTS aaj_inventory;
USE aaj_inventory;

-- Remove old tables (transactions first, because it depends on products)
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;


-- ---------- Table 1: users (login accounts) ----------
CREATE TABLE users (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    username  VARCHAR(30)  NOT NULL UNIQUE,
    password  CHAR(64)     NOT NULL,                  -- SHA-256 hash, not the real password
    role      ENUM('admin', 'staff') NOT NULL
);


-- ---------- Table 2: products ----------
CREATE TABLE products (
    code           VARCHAR(20)   PRIMARY KEY,         -- unique product code
    name           VARCHAR(60)   NOT NULL,
    category       VARCHAR(40)   NOT NULL,
    price          DECIMAL(10,2) NOT NULL,
    reorder_level  INT           NOT NULL DEFAULT 5,  -- low-stock alert when quantity <= this
    quantity       INT           NOT NULL DEFAULT 0,
    archived       TINYINT(1)    NOT NULL DEFAULT 0   -- 1 = hidden (archived)
);


-- ---------- Table 3: transactions (stock-in and sales history) ----------
CREATE TABLE transactions (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    type        ENUM('stock_in', 'sale') NOT NULL,
    code        VARCHAR(20)   NOT NULL,
    qty         INT           NOT NULL,
    amount      DECIMAL(10,2) NOT NULL DEFAULT 0,     -- total money (sales only)
    supplier    VARCHAR(60)   NULL,                   -- stock-in only
    tdate       DATE          NOT NULL,
    undone      TINYINT(1)    NOT NULL DEFAULT 0,     -- 1 = reversed by Undo
    created_by  VARCHAR(30),
    created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (code) REFERENCES products(code)      -- must point to a real product
);


-- ---------- Sample accounts: admin / admin123 and staff / staff123 ----------
INSERT INTO users (username, password, role) VALUES
    ('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'admin'),
    ('staff', '10176e7b7b24d317acfcf8d2064cfd2f24e154f7b5a96603077d5ef813d6a6b6', 'staff');


-- ---------- Sample products ----------
-- (code, name, category, price, reorder_level, quantity, archived)
INSERT INTO products VALUES
    ('DF001', 'Dog Food Adult 1kg', 'Dog Food',    185.00, 10, 40, 0),
    ('DF002', 'Puppy Starter 1kg',  'Dog Food',    210.00, 10,  8, 0),
    ('CF001', 'Cat Food Tuna 1kg',  'Cat Food',    195.50,  8, 25, 0),
    ('CF002', 'Kitten Mix 500g',    'Cat Food',    120.00,  8,  5, 0),
    ('TY001', 'Chew Bone Toy',      'Toys',         65.00,  5, 30, 0),
    ('AC001', 'Pet Shampoo 250ml',  'Accessories', 150.00,  5, 12, 0),
    ('AC002', 'Leather Leash',      'Accessories', 230.00,  4,  3, 0),
    ('FS001', 'Fish Flakes 100g',   'Fish Food',    55.00,  6, 18, 0);
