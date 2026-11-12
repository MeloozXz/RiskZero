-- =============================================================================
-- RISKZERO (SeguranApp) - Script Físico de Banco de Dados Relacional (PostgreSQL / Supabase)
-- Arquitetura: Zero-Knowledge (Cifragem AES-GCM 256 Client-Side)
-- Alinhado com docs/DIAGRAMAS_MERMAID.md (DER Lógico) e src/types/index.ts
-- Requisito: 8 entidades normalizadas, PKs, FKs, CHECKs, índices e >= 20 registros/tabela
-- =============================================================================

-- Limpeza segura para reexecução idempotente (ordem reversa de dependência)
DROP TABLE IF EXISTS sessoes_ativas CASCADE;
DROP TABLE IF EXISTS assinaturas_planos CASCADE;
DROP TABLE IF EXISTS servidores_vpn CASCADE;
DROP TABLE IF EXISTS logs_auditoria CASCADE;
DROP TABLE IF EXISTS historico_senhas CASCADE;
DROP TABLE IF EXISTS cofre_itens CASCADE;
DROP TABLE IF EXISTS cofre_envelope CASCADE;
DROP TABLE IF EXISTS usuarios_perfil CASCADE;

-- -----------------------------------------------------------------------------
-- 1. USUARIOS_PERFIL
-- -----------------------------------------------------------------------------
CREATE TABLE usuarios_perfil (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(150) NOT NULL UNIQUE,
    salt VARCHAR(64) NOT NULL,
    kdf_algorithm VARCHAR(16) NOT NULL CHECK (kdf_algorithm IN ('argon2id', 'pbkdf2')),
    password_hash VARCHAR(128) NOT NULL,
    pin_hash VARCHAR(128) NOT NULL,
    encrypted_totp_secret TEXT,
    totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 2. COFRE_ENVELOPE (Relação 1:1 com USUARIOS_PERFIL)
-- -----------------------------------------------------------------------------
CREATE TABLE cofre_envelope (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL UNIQUE REFERENCES usuarios_perfil(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    encrypted_dek_ciphertext TEXT NOT NULL,
    encrypted_dek_iv VARCHAR(64) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 3. COFRE_ITENS (Relação 1:N com COFRE_ENVELOPE)
-- -----------------------------------------------------------------------------
CREATE TABLE cofre_itens (
    id VARCHAR(64) PRIMARY KEY,
    envelope_id VARCHAR(64) NOT NULL REFERENCES cofre_envelope(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    username VARCHAR(150) NOT NULL,
    encrypted_password_ciphertext TEXT NOT NULL,
    encrypted_password_iv VARCHAR(64) NOT NULL,
    url VARCHAR(255),
    category VARCHAR(20) NOT NULL CHECK (category IN ('LOGIN', 'CARD', 'NOTE', 'IDENTITY', 'OTHER')),
    encrypted_notes_ciphertext TEXT,
    encrypted_notes_iv VARCHAR(64),
    encrypted_totp_secret TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 4. HISTORICO_SENHAS (Relação 1:N com COFRE_ITENS)
-- -----------------------------------------------------------------------------
CREATE TABLE historico_senhas (
    id VARCHAR(64) PRIMARY KEY,
    item_id VARCHAR(64) NOT NULL REFERENCES cofre_itens(id) ON DELETE CASCADE,
    username VARCHAR(150) NOT NULL,
    encrypted_password_ciphertext TEXT NOT NULL,
    encrypted_password_iv VARCHAR(64) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 5. LOGS_AUDITORIA (Relação 1:N com USUARIOS_PERFIL)
-- -----------------------------------------------------------------------------
CREATE TABLE logs_auditoria (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES usuarios_perfil(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    action VARCHAR(40) NOT NULL CHECK (action IN (
        'LOGIN_SUCCESS', 'LOGIN_FAILED', '2FA_VERIFIED', 'PIN_LOCKED',
        'CREDENTIAL_CREATED', 'CREDENTIAL_UPDATED', 'CREDENTIAL_DELETED',
        'PASSWORD_COPIED', 'BACKUP_EXPORTED', 'VAULT_IMPORTED', 'DEK_ROTATED',
        'SUBSCRIPTION_UPGRADED', 'SUBSCRIPTION_CANCELLED', 'SCREENSHOT_BLOCKED',
        'AUTO_LOCK', 'LOGOUT', 'ROOT_DETECTED', 'SESSION_INVALIDATED',
        'VAULT_HEALTH_CHECK', 'BREACH_DETECTED', 'VPN_CONNECTED',
        'VPN_DISCONNECTED', 'VPN_KILLSWITCH_TRIGGERED', 'VPN_IP_VERIFICATION_FAILED'
    )),
    details TEXT NOT NULL
);

-- -----------------------------------------------------------------------------
-- 6. SERVIDORES_VPN (Nós WireGuard disponíveis para conexão)
-- -----------------------------------------------------------------------------
CREATE TABLE servidores_vpn (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    country VARCHAR(80) NOT NULL,
    city VARCHAR(80) NOT NULL,
    flag VARCHAR(16) NOT NULL,
    endpoint VARCHAR(150) NOT NULL,
    port INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
    server_public_key VARCHAR(128) NOT NULL,
    client_address VARCHAR(45) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('AVAILABLE', 'UNAVAILABLE', 'MAINTENANCE')),
    is_custom BOOLEAN NOT NULL DEFAULT FALSE,
    ping INTEGER NOT NULL CHECK (ping >= 0)
);

-- -----------------------------------------------------------------------------
-- 7. ASSINATURAS_PLANOS (Relação 1:1 com USUARIOS_PERFIL)
-- -----------------------------------------------------------------------------
CREATE TABLE assinaturas_planos (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL UNIQUE REFERENCES usuarios_perfil(id) ON DELETE CASCADE,
    tier VARCHAR(16) NOT NULL CHECK (tier IN ('FREE', 'PRO', 'ULTRA')),
    billing_cycle VARCHAR(16) NOT NULL CHECK (billing_cycle IN ('MONTHLY', 'ANNUAL')),
    status VARCHAR(16) NOT NULL CHECK (status IN ('ACTIVE', 'EXPIRED', 'TRIAL')),
    started_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ,
    auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
    payment_method VARCHAR(20) CHECK (payment_method IN ('PIX', 'CREDIT_CARD'))
);

-- -----------------------------------------------------------------------------
-- 8. SESSOES_ATIVAS (Relação 1:N com USUARIOS_PERFIL)
-- -----------------------------------------------------------------------------
CREATE TABLE sessoes_ativas (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES usuarios_perfil(id) ON DELETE CASCADE,
    device_name VARCHAR(150) NOT NULL,
    last_active TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_placeholder VARCHAR(80) NOT NULL
);

-- Índices para otimização de consultas por chave estrangeira e filtros
CREATE INDEX idx_cofre_itens_envelope_id ON cofre_itens(envelope_id);
CREATE INDEX idx_cofre_itens_category ON cofre_itens(category);
CREATE INDEX idx_historico_senhas_item_id ON historico_senhas(item_id);
CREATE INDEX idx_logs_auditoria_user_id ON logs_auditoria(user_id);
CREATE INDEX idx_logs_auditoria_action ON logs_auditoria(action);
CREATE INDEX idx_sessoes_ativas_user_id ON sessoes_ativas(user_id);
CREATE INDEX idx_servidores_vpn_status ON servidores_vpn(status);

-- =============================================================================
-- POVOAMENTO DO BANCO DE DADOS (22 REGISTROS VÁLIDOS POR TABELA - MÍNIMO 20)
-- =============================================================================

-- 1. Inserção de 22 registros em usuarios_perfil
INSERT INTO usuarios_perfil (id, username, salt, kdf_algorithm, password_hash, pin_hash, encrypted_totp_secret, totp_enabled, created_at) VALUES
('usr_01_ana_silva', 'ana.silva@riskzero.dev', '1bfd0e45d5fada406860ebb8973f8e81', 'argon2id', '8084c9b7017975bd07c30a807ac8fa884f8a69a42d1b029a769507b52eb957b7', 'a02ff07ec867eefce1fb2bed9ce36a085453ecee5a4441e08a561357d897c333', 'nGto0GQ6eO0ssLVr748ps0U7QBxUqokeFUkgI1bPMlQ=', TRUE, '2026-01-05T10:15:00Z'),
('usr_02_bruno_costa', 'bruno.costa@riskzero.dev', 'c4b1480351c9f3a85fb9fa46c600fd62', 'argon2id', '491bbad54c14470778b72c9952b82a18e4665b15c7ccc0c65828d93f91c2dc88', '2053dc7b019bfcb6591c23d4bf1c27d2fa03f5d0bb85aafd802f25a772ef4de2', 'VV9LzWzIw41a/7pkdGalXzh81XyGp3G5LEE5owFdSbI=', TRUE, '2026-01-08T14:22:10Z'),
('usr_03_carla_mendes', 'carla.mendes@riskzero.dev', 'b93bfdf26725ac03a7e7be927f171178', 'pbkdf2', '4df4372df9f13bffe81afa7b916c602772e911b32c278aa45004dcbe752ea715', '986ef849cdfb5786ef3e4983b4d72341956c74fac884d80889e422b2dcb04f8d', NULL, FALSE, '2026-01-12T09:05:33Z'),
('usr_04_daniel_souza', 'daniel.souza@riskzero.dev', 'a8b7bedc9fe115f59e0d18f4d43b4ca7', 'argon2id', '040a4a0c05e64573f369c4e22b5caaa71126e28926e11b73a66fbb64ff2b70b1', 'a7163893abfaaedcbd7402a471ded6a8ad373b5c13e1a6aacce5aa823d55ed9b', 'qjHdYpjQj41QgsIypgvYnFvbvmzvFj3Qlw8HA59EV/A=', TRUE, '2026-01-15T18:40:00Z'),
('usr_05_eduarda_lima', 'eduarda.lima@riskzero.dev', '9069ce4fb6b405b99e119f664a15b5a0', 'argon2id', 'b769464bbee8632c6a1ec0747b39708f7d81fb16d81a0ef12a4bb48a7566c6f4', '9cf965a5316535679d10d62de4aa582111d2d63af61ec165abb4771b74eed035', 'FEukSznT9y6+AejmGiEL1bDWYUtHQHquOfa9DMHCbpM=', TRUE, '2026-01-19T11:12:45Z'),
('usr_06_felipe_rocha', 'felipe.rocha@riskzero.dev', '2f5ec611f2fe1b47cf93a16b4cbf0b23', 'pbkdf2', '5f24e11809e00d0f5f5661294da5f84f9b2c4a7d9db404cd66b90feb537877fb', '90d360dd94f1f0b1772b8405ea49d98b3532d35bf2e840bdbaf46bd6329a0464', NULL, FALSE, '2026-01-23T16:30:12Z'),
('usr_07_gabriela_alves', 'gabriela.alves@riskzero.dev', 'f30c08b2fa1b9ca85a4147242200651b', 'argon2id', 'f61a313605a022683504c05ca24d0439f89a159ef40da11008772079b55d92b4', '9ed3721c37af1b304b3e11316b753d916e9267d1cab78cc16a9ef42c0b04d538', 'XJRfeCixMVWypewJAXHmM5NhkAxFg6+XzE09tJMGqm0=', TRUE, '2026-01-27T08:50:19Z'),
('usr_08_henrique_dias', 'henrique.dias@riskzero.dev', '7891f3aeb19de6e5e7c8ccb73add160c', 'argon2id', '215bdff62985a2cb1060a57404b50e9636385e8df1994ee93f00e8622ddee78a', '208873c6951450cfa14ba8104c712d28e4716fab6647b83354d4d3e35d282a84', 'h4ZmAsld7+8pK/SGWt8yaKIE6RTrKsVEf1YTxwJbf24=', TRUE, '2026-02-01T13:18:40Z'),
('usr_09_isabela_nunes', 'isabela.nunes@riskzero.dev', '2764c04d31bd5cfd9b6bc0504ef7ba97', 'pbkdf2', 'fd007e0615a7e1ed9b6e1e012d457542d8674c908029fe4acd292ec0b6fc11da', '8ac77dcd0c587d8ffa4ad65cace968bb41616abd7115f9cb8f26899f2f29af1c', 'MEKUn47LRyuuqZRnmPrZyI650AU3yEOFjgXogs57Ml4=', TRUE, '2026-02-04T20:05:11Z'),
('usr_10_joao_pedro', 'joao.pedro@riskzero.dev', '4271c6962ec3c087687f2453456d1f5d', 'argon2id', '35ae941127379f00b74d2f9accaa6a119ab49acefaeb5695c0edcce1c2d8b496', '4a273e86c88b8bf3ae5f43bcab785340809ba06aa590276491e26518fed93050', NULL, FALSE, '2026-02-09T07:44:29Z'),
('usr_11_karina_martins', 'karina.martins@riskzero.dev', '0c958c9dd1d9c2adcc8d3d351c556cfe', 'argon2id', '36a80a3b0f51ff89f028e653495578c7076103fdd813eb6834336cb9ef85b98e', 'a3cac37e76f918f508af6af5faa65440d986af54ac5701e3b15b5be3ddcb5795', 'v1lwVFQIWSB/Qf5RCtKM7Gq1zYXzf0/FcM7NQhLTcns=', TRUE, '2026-02-14T15:21:05Z'),
('usr_12_lucas_ferreira', 'lucas.ferreira@riskzero.dev', '3f412b98c406b56af372b052cea13985', 'argon2id', 'd63a81a95027b85bcce05e4d1e3d1c2b7639cb12bb384b3591e32e0d6b833a93', '6bace3f011fef05e7ba8e64ee018bac7db714008236161c90feaf7539821069c', 'aZhVgw3CjE8IfiyJOTJScum01fxAPnYyxRvpU2gtQk4=', TRUE, '2026-02-18T19:09:50Z'),
('usr_13_mariana_gomes', 'mariana.gomes@riskzero.dev', '2dc8554a793c379b2bc8c3d230821355', 'pbkdf2', '51227342d4de4fd3ae3077c3127e1547cbacfe35d9b014fdfa02d7a0ef414c3c', 'fecd6f07b7502d13355cbce5ad531d67b760bdbf9f8cb1996ece8fa584fb224e', NULL, FALSE, '2026-02-22T12:33:14Z'),
('usr_14_nikolas_melo', 'nikolas.melo@riskzero.dev', 'e94b2e2b68fd91cf94fe57b02b472893', 'argon2id', 'c8170fcc6dd97306a29868e064f23e38301480075fb4730e0b43a3223b0cf10b', '28b7348fb2203a691e8733e7dfe51f4134e24c815cdbd91724fdbe89583729b8', 'zPo3QA+nn/XG7ZJdejhXSFzKxyVccj6SqJxSkANuTmk=', TRUE, '2026-02-25T10:00:00Z'),
('usr_15_olivia_santos', 'olivia.santos@riskzero.dev', '0585c8b4df8eaeec39f8326d702eec90', 'argon2id', 'f7bebff8ea13d3c6258d8dfdf2dc35c58194407c57bf626a71e8baa60d5b2e31', 'a77eff638d6aa3497aa976181657ad9fec4d9e6e6bb79de78dd46207ea066db2', '4raZj3joHvb0GSUyT6hinwhdbElTNxKBF2PX2dVWEgI=', TRUE, '2026-03-01T17:45:22Z'),
('usr_16_paulo_ribeiro', 'paulo.ribeiro@riskzero.dev', 'a2218a5fcd07a719bf7c01d222c81d34', 'pbkdf2', '3ca733f037fd927a8bbb76a2bcfc7256e6fda09ecb73d9be295c65ec251a5947', '5e614468c5d0e605be725b4ef94ca0f0efef422870d43ef7c0cb93d177222a01', NULL, FALSE, '2026-03-05T09:14:38Z'),
('usr_17_rafaela_castro', 'rafaela.castro@riskzero.dev', 'fb31eba0431a6796f85296bef8154c53', 'argon2id', '8430c79af3759e9f6016ea8a4832c77c84dc97cc5e182cce13359227337ba6ce', 'aee39b6ac897e07bcfdbf4321807484513b4d23f4204ef5116bac5362ef79e65', 'oPRkr9dMg/30+XNhLPN7gES+IGF5oamcy64gExC5aZc=', TRUE, '2026-03-09T21:11:09Z'),
('usr_18_samuel_oliveira', 'samuel.oliveira@riskzero.dev', 'f064ed50d70cade4e4694c3b388ac29a', 'argon2id', '9c8088fd6d883503a937dcd147a10ace241f8eadf5e984c3c3c26563119a3030', 'f7d5707d9d154cd2dd2a3cc230c8f628b3d072ad74500cb5f075abb1cb6d9ec8', 'zbFIsF8dCiTDh/O9/yXdqat9Ch8HaWNNlbgulXm7BAA=', TRUE, '2026-03-12T14:55:47Z'),
('usr_19_tatiana_barros', 'tatiana.barros@riskzero.dev', '56c57e1055c9b569f68549bfa3d2e06f', 'pbkdf2', '347abb3c48eb22009fd69737106114bb52045f41fccfb258c53a97dc2eda0a7d', 'b36af5ae7f5393178f2bf347882a326f900578042ebb047d7aca4c46c2a04d25', 'soGHy9mvgcz3+r304qVZxG/cZi+DKPJe/9z3vSkjJ7k=', TRUE, '2026-03-16T08:20:30Z'),
('usr_20_vinicius_cardoso', 'vinicius.cardoso@riskzero.dev', 'cf2127f27c6e77430c4a5bd4880d80dc', 'argon2id', '18daa0776b53f800d67c93a196b750344562bf4a0c5e68390f4aa48925f7ab0a', 'b4224dae1be75748d22f2eba8a8e92bd65fcf23df7edca11e79a0c072e90c6d3', NULL, FALSE, '2026-03-20T16:05:18Z'),
('usr_21_yasmin_pereira', 'yasmin.pereira@riskzero.dev', '984e1c562af433b467f0b671eb69bfd9', 'argon2id', '2348d4ab5fb3ee929483ce3f81dc5c4527c13b507620c6456fdd0241b2db2819', 'cc70f26fb40b8b4543e4ccc2be6196848bbde05c794c31b1acfc7a47e18fb2b2', 'B43jdAkYfVgJVAy9d24DVKM31AgC9shOwBOEBk453as=', TRUE, '2026-03-24T11:38:02Z'),
('usr_22_matheus_araujo', 'matheus.araujo@riskzero.dev', '56fef4c908e9577dad907e20cf2d02f2', 'argon2id', 'e953b09fc87b0b524ab7c5a69c59aa326a3d00430714a30acc358bf3e0ac0621', '0d1a52f8e2eeddcf632c9ace87afec159a642b24b707368ab81e132e4d635825', '9cxMMjHVHRIPPYFxKlzU8J/S+osqdb12JJJAtxOmfCg=', TRUE, '2026-03-28T19:42:55Z');

-- 2. Inserção de 22 registros em cofre_envelope
INSERT INTO cofre_envelope (id, user_id, version, encrypted_dek_ciphertext, encrypted_dek_iv, updated_at) VALUES
('env_01', 'usr_01_ana_silva', 1, 'mdk9ssBLJ+w8l2FIOjkmx/3glh4BuySpl0hmJd8WnDcMi/bZUVBKX/F82eow8q/4', 'Y09R/rpBhIrwHB5v', '2026-04-02T12:00:00Z'),
('env_02', 'usr_02_bruno_costa', 1, 'WngrRWw/jDhYuY9U6rH1xUSh4w7Gqdf/U2NsQ0iSkaHPuCPFhcvHHE623LXgqPx4', 'yLsjwgPsxYhxjktN', '2026-04-03T12:00:00Z'),
('env_03', 'usr_03_carla_mendes', 1, 'R01pJ1oTbc3LgH2ywI7rHKPWMHgDtFMMzzR9lyUiXQqiAuZ5KXs5ghQjtPCJl+hd', 'Y+as6+J+E6MiD8zM', '2026-04-04T12:00:00Z'),
('env_04', 'usr_04_daniel_souza', 1, 'qqarXt3twSdhUurQwSUnZQ6H08EYom5dW59CQ7vfbk1t4/VccuxB8dTkp6U6T49x', 'ArFJcFvYo1FfiHJm', '2026-04-05T12:00:00Z'),
('env_05', 'usr_05_eduarda_lima', 1, 'rSgifhN8rEzy8pnsFcrPlc/YMTpv6v1DJHqogwZpneEQ2molgLK7+FTHFGoMsc+g', 'CgMBnm4taCNgLLm4', '2026-04-06T12:00:00Z'),
('env_06', 'usr_06_felipe_rocha', 1, 'U34G1ZxkJGXhuSEOQvC4bmDFpk17UT5DejhNJC8jxyOzHHAJy9J2889w8N+aklnA', 'HpQ12NYhbX0dWJcu', '2026-04-07T12:00:00Z'),
('env_07', 'usr_07_gabriela_alves', 1, '44M72VkNhuhHo6H+rrkXWMGJvaFLXoYtd9LFuvvASNI5+pnIU3XOUh/gPTmc5zEd', 'REldyQ49HJ2s3S4E', '2026-04-08T12:00:00Z'),
('env_08', 'usr_08_henrique_dias', 1, 'JkBgZkHWNpEQ9EpHfuXWxFYrGWGiytziUEF5hwZqmV5YpEtCtos1VbPgyjsSSFmA', 'nXDkRNFb3a2Zfj/s', '2026-04-09T12:00:00Z'),
('env_09', 'usr_09_isabela_nunes', 1, 'QzmyJXMSek0xncwBRpiD9yH7MPv6aO8IbfdU0oqD96MkuI0RPxbtwi4bGJs0mmYW', 'vUX9iEXyNTwwFy0d', '2026-04-10T12:00:00Z'),
('env_10', 'usr_10_joao_pedro', 1, 'AYgD4lK7sXtTkMuU6MlAjbwxclJivEWwMyk814y4fCMOmRtNK6Cdy3cAGsXdtYGq', '1KYDnoDgt2OCPnuf', '2026-04-11T12:00:00Z'),
('env_11', 'usr_11_karina_martins', 1, 'H2v89Q/Xy10K2fxsvpNK0mUnYNAm6DFLXHZO00iGnksE6VV43xGN/1gZe1sclsId', 'MZ5wwghDL2vbKfsJ', '2026-04-12T12:00:00Z'),
('env_12', 'usr_12_lucas_ferreira', 1, '7dZKibQ1DdjF9PT/zLRQwAjNR0sWcUwtLT25N+KSdx90CR2c7nsd8/Rr2exSR5oX', 'bDbEKRcWMBP2Zyvh', '2026-04-13T12:00:00Z'),
('env_13', 'usr_13_mariana_gomes', 1, 'S97+vW8AeuutXv2Gq8Zi6Kj1TzLQY1Jmb2ddxPCwswnym+0lwkIIrqgZqY4+A07q', 'GnUwGkkp8Pku+C07', '2026-04-14T12:00:00Z'),
('env_14', 'usr_14_nikolas_melo', 1, 'yqJ8FR7yNPfOhWuKNrgf4a8zEYnsAPjVfqWSnukI+SqoTIjLxm1FvzyozK0v4fsZ', 'fntp/Y+ERiaLcHyj', '2026-04-15T12:00:00Z'),
('env_15', 'usr_15_olivia_santos', 1, 'xK9pQd19GIjmvuS+uSNhHCQndgZIAuGCulB/jNed5fvZnweP0ojQ9MOibe8Q++S2', 'NEis+TY1/2QFWluJ', '2026-04-16T12:00:00Z'),
('env_16', 'usr_16_paulo_ribeiro', 1, 'ogFINMYLZjnlYzynKJrN7azDOBCynx/M8Bk8j71iypJpQkxBE1BhNq4eYTV23sX6', 'fO4BMKA0Q76SVY+u', '2026-04-17T12:00:00Z'),
('env_17', 'usr_17_rafaela_castro', 1, 'XQgUu1GHGt49oFmoHBHgyfu4NOzaEQr7mg06k5HBW7jXQUDAnKvMljLtr/IdNhQV', 'JWO7LxwXYIPbERa0', '2026-04-18T12:00:00Z'),
('env_18', 'usr_18_samuel_oliveira', 1, 'JTYv/oc0JCYa1JrzCYupLa2I6kV+dg9YmCp2g2WTwF7W6xV4KwsxAtFOzJogtNnB', 'Erz2KucnEdiFZI8S', '2026-04-19T12:00:00Z'),
('env_19', 'usr_19_tatiana_barros', 1, 'zd3kKsdLCoLnuJufPt72KQjVX5NPgbeMrSF1e049RvKBMeAkvVEYMoZXLCNxI/4b', 'Mvmov//0o8eYvVrg', '2026-04-20T12:00:00Z'),
('env_20', 'usr_20_vinicius_cardoso', 1, 'VdQ7veYCQH/BPGUw7Nw39qO14ejl7RQTTnx7QqJPoaffpfokFr5PRdr7CENa3b2Y', 'yOdeAgGd/M7TLIMk', '2026-04-21T12:00:00Z'),
('env_21', 'usr_21_yasmin_pereira', 1, 'KWs3Gm/8VZgIZLsMLy1KZgll41ba4EYzxc8DnFzSQ6tIh2Pfej3TcTaEyRpNdE8a', 'LbmF2nbW9IXRfov7', '2026-04-22T12:00:00Z'),
('env_22', 'usr_22_matheus_araujo', 1, 'kZjqsQ4cmuMPQjWOU5HdnaKashmX2BPI6Fqkmr5u2u6PHa3YZbw4sgb/eaD7Il5J', 'Xm+13MviAk/wL7Yh', '2026-04-23T12:00:00Z');

-- 3. Inserção de 22 registros em cofre_itens
INSERT INTO cofre_itens (id, envelope_id, title, username, encrypted_password_ciphertext, encrypted_password_iv, url, category, encrypted_notes_ciphertext, encrypted_notes_iv, encrypted_totp_secret, updated_at) VALUES
('item_01', 'env_01', 'GitHub Corporativo', 'dev.ana', 'HU81n6q8mfTw9y+nKoTjnpMnsyydgnZKANM6jSKnG4E=', 'tgoP0Wt77CzvGaCR', 'https://github.com/login', 'LOGIN', 'n1IDhXfBPBWssEAzYYAQ0VMsS89fSXJlLIC4ckbj9+728s2bl2yd2KKKE+MZb2OR', 'Rj8sDAvjoFmLUAbd', NULL, '2026-05-02T15:30:00Z'),
('item_02', 'env_02', 'AWS Console Produção', 'sec-admin@empresa.com.br', '80x9JCRaGx2E7XJ2L2Et2Fzvj3fevnXjVk9vvaRye8k=', 'RyBpW34pFoZgA8LO', 'https://console.aws.amazon.com', 'LOGIN', NULL, NULL, NULL, '2026-05-03T15:30:00Z'),
('item_03', 'env_03', 'Nubank Internet Banking', 'cpf.00011122233', '3WWKncGFwwV3T6dzIJaqXCDkPqxWTvhsGflsaeLUqpk=', 'apeqav+cxyQkm0/R', 'https://app.nubank.com.br', 'LOGIN', '4JwTfT8uyEzfht6gycF6t4333cinrlTCEOaCpBxcq07WxHgbn9NfWmgwritjhtIk', 'tvhlMVaUH0pI/63Q', '9zAjdtbGKSi5qriDAQbaIXYUzVXh5NQz', '2026-05-04T15:30:00Z'),
('item_04', 'env_04', 'Cartão Corporativo Visa', '4532 **** **** 8821', '1gUoqrlZg/zhpAHansg3+6/yTFrT2gtUdG9UzVCPDRU=', 'de/aVWHhmicV2xuW', 'https://portal.visa.com.br', 'CARD', NULL, NULL, NULL, '2026-05-05T15:30:00Z'),
('item_05', 'env_05', 'Chave de Recuperação 2FA', 'backup-codes-root', '5+WdjQcGlxraXRdzrcg/2OqEDgdX+QPTvShgCQXpVO8=', 'b6JQze77/H21vLkQ', NULL, 'NOTE', '5SZTHqWugD99uzvHNYWR2FWWuXYHzQlTqrWmvTeHHvXf2WBL0HoZHH04EnVnHQD/', '7ncldXMOU8/I4GF4', NULL, '2026-05-06T15:30:00Z'),
('item_06', 'env_06', 'Passaporte e CNH Digital', 'BR-99887766', 'voT+devrYW6p3KdlfwXXYDSP3BOkEmWsMbNtsLdsbGk=', 'wGDoDwEunwmgHBWK', 'https://www.gov.br', 'IDENTITY', NULL, NULL, NULL, '2026-05-07T15:30:00Z'),
('item_07', 'env_07', 'Cloudflare Dashboard', 'infra@riskzero.dev', 'WGqNWrY0T0Bc2dYgjd8TfWnrdHWtIjL/5dmwlJ6SbrI=', 'UnZdcH9e4eX9LbwK', 'https://dash.cloudflare.com', 'LOGIN', 'QPdftS+LnJg0x52QAYAc+BSbIXgsr5jDVFgzUjHisU2o9u7Cz6qeL3EWlQE4s2LG', 'w7SLFK22aAlrNgd6', NULL, '2026-05-08T15:30:00Z'),
('item_08', 'env_08', 'Firebase Console', 'nikolas.melo@riskzero.dev', 'hGyyxLQp3R0Zf+z/3pU3OM7FACo4myfNZyMyJ8JOFgo=', 'mHjxbeZFxNy1oaCI', 'https://console.firebase.google.com', 'LOGIN', NULL, NULL, NULL, '2026-05-09T15:30:00Z'),
('item_09', 'env_09', 'Cartão Mastercard Black', '5412 **** **** 3390', 'BBs+g4VZGghDOink7DgHcA75ZMGQWfNxP1L+U7Q0LiI=', 'RJ/3EciBIc0mR0Ov', 'https://www.mastercard.com.br', 'CARD', '1oPD+jP/DyUmWkMUTqXfBzYK4ZRIrVPi35ZRm21fbdSLWZUITnybTi5aO3caCC4y', 'v4+ws0w3j/MIPSea', NULL, '2026-05-10T15:30:00Z'),
('item_10', 'env_10', 'Servidor VPS WireGuard', 'root@203.0.113.42', 'EsjbepTF1TODqnhc3ZJ+4zo6haywotZUf4QAgFM7EfE=', 'vVzsC7U8GxgcWWb3', 'https://panel.vps.local', 'OTHER', NULL, NULL, NULL, '2026-05-11T15:30:00Z'),
('item_11', 'env_11', 'Gmail Pessoal', 'carla.mendes@gmail.com', 'Z2fAcRMG/lFK9Giz/YabFK5cbf5uRcRpAKRbAbKRHg0=', 'RQnKsb/AQr6FIkM3', 'https://accounts.google.com', 'LOGIN', '4F/31Wd8pa2649hDw7SuBselZvFY+tC2oWYnPAMY/b9pddeSvJmQ7XpUvjyq8J8S', 'WOB2wMgGJHLbdo8F', NULL, '2026-05-12T15:30:00Z'),
('item_12', 'env_12', 'LinkedIn Profissional', 'daniel.souza.sec', 't6bvTsi1Wzqe9c29ioRAfCLxALwD8PjL3vbxYk/Aurk=', 'FWVgYGBK+LOT8zTz', 'https://www.linkedin.com/login', 'LOGIN', NULL, NULL, 'KdRwg113BtxXRM2NEN8Kf55wjjcT7wXK', '2026-05-13T15:30:00Z'),
('item_13', 'env_13', 'Notas Fiscais e CNPJ', '12.345.678/0001-90', 'V3+JxOL6cCvbrh0g5k2oSzKVrGScOrCjCHv9z64pLQs=', 'K9i8nnv96g8fSIG4', NULL, 'NOTE', 'j3YTQisStLUiyB9wOnrqProYkVmGPRJhjen2kFzNKBG+aOLF3a5TGilWbP++/WXU', 'WdnVCqS9CimCPSgM', NULL, '2026-05-14T15:30:00Z'),
('item_14', 'env_14', 'Registro Profissional CREA', 'SP-506987412', 'PnYnPYD2EeYiNMAmxUl9aavvsSHUD+XHm0+3n9TncLs=', '5g1aIxFU5CQIBO4w', 'https://creanet.creasp.org.br', 'IDENTITY', NULL, NULL, NULL, '2026-05-15T15:30:00Z'),
('item_15', 'env_15', 'Supabase Cloud', 'admin@riskzero.dev', 'yNijQHVm9azCRmIJoWtCZVkgEPhgeAX93XCXSWsnqPE=', 'PeqRPU7MrDAb1wnE', 'https://supabase.com/dashboard', 'LOGIN', 'oyVbZx/pqMKQOvDw2FWK2Kmp6Bg9bCS8BLNeYezdiBGr9/POnRWZiOT+PhOCkkzo', 'M1+AIXhJQnZSQUwj', 'UhFd/R5TUJyuRt8OjOksqyEaOfc7U7Yc', '2026-05-16T15:30:00Z'),
('item_16', 'env_16', 'Mercado Livre', 'felipe.rocha.compras', 'SU6Lj1fRxMQIGnCI0jPnXkb/YxPBwZEO0f7e0FFnYWc=', 'gw2S/Pu325WIKcsc', 'https://www.mercadolivre.com.br', 'LOGIN', NULL, NULL, NULL, '2026-05-17T15:30:00Z'),
('item_17', 'env_17', 'Cartão Débito Inter', '4984 **** **** 1104', 'KTJBtdvnWamN1P1PeMPeTemO9OqlntvpCnxn7rRAYSs=', 'HJnA+1nWnM61yV3j', 'https://www.bancointer.com.br', 'CARD', 'BEnf3HdqeBi4umN4Mo2FIA4TaoQn03W93wcB2803eTGR3GN/K0tUpTyRdR2kUFIu', '68IxpoMgcHnt4CM6', NULL, '2026-05-18T15:30:00Z'),
('item_18', 'env_18', 'Seed Phrase Hardware Wallet', 'ledger-vault-01', '7XJU0MbJzTgtUhEObAoiXYAS0Mntm36XEtuY3hcGRoc=', 'LLkzpppvxLfwiQxl', NULL, 'NOTE', NULL, NULL, NULL, '2026-05-19T15:30:00Z'),
('item_19', 'env_19', 'Portal Acadêmico TCC', 'ra20261045', '4RFvty54LUMbZpBZUUSDLrH24l84EgMa0pXwJS1Yu0E=', 'U31PByQg6ZbYAnrB', 'https://portal.faculdade.edu.br', 'LOGIN', 'RE0211DnHoo/x2V1gJDO74E8c1manIq6CySzcQt9F+IDmUC5VXXDWTcvBSwa06Jq', 'dss/sj6qaYr2Ds3Y', NULL, '2026-05-20T15:30:00Z'),
('item_20', 'env_20', 'Token API Produção', 'rk_live_prod_key', 'iIlRRhKjxGiTOySSnZta44DSwpc2TGdXL2DinWMXKH4=', 'dayAGxS6hzlLCsVw', 'https://api.riskzero.dev', 'OTHER', NULL, NULL, NULL, '2026-05-21T15:30:00Z'),
('item_21', 'env_21', 'Discord Comunidade', 'yasmin.sec', 'G2B1a2WIgdA24qm3yAUkzyP1pkN+dHI8J7hdZW5iv6A=', 'z6Ub6OF3mjK80Yec', 'https://discord.com/login', 'LOGIN', 'wUzviNNDLTJ5yY/1Zm9KcEhpjfYYVh3eeaOTmfrVjBWNKFDsDTKIkhKJmdC/HZHN', 'gnhB+LogzjR792sy', 'yYG6yCAZJeyfVd6A77fnHVEiZI9ojzF4', '2026-05-22T15:30:00Z'),
('item_22', 'env_22', 'Certificado Digital e-CPF', 'matheus.araujo', 'PcuUtXjo2rafmBmhmIJ/RjP3hr/EpTts5I4X779ga+0=', '4ZseXqfx419D8hq2', 'https://certisign.com.br', 'IDENTITY', NULL, NULL, NULL, '2026-05-23T15:30:00Z');

-- 4. Inserção de 22 registros em historico_senhas
INSERT INTO historico_senhas (id, item_id, username, encrypted_password_ciphertext, encrypted_password_iv, updated_at) VALUES
('hist_01', 'item_01', 'dev.ana', 'OtsKUoEcos9NaelM6+BNLqLw8cIiU41/bqIYQ4ixjko=', 'UNerD7ndVBaLFwPo', '2026-04-02T09:45:00Z'),
('hist_02', 'item_02', 'sec-admin@empresa.com.br', '3KDKEGJsCWBTc0YpaOup2/7wBLaBy+VUdWS8bKY0cP8=', '5QGzpPrS428QduT7', '2026-04-03T09:45:00Z'),
('hist_03', 'item_03', 'cpf.00011122233', 'w7FTJNmftiNVnzrc8qW5oGRWcbr7qZp/cYb59yhnjmI=', 'aGyUV3wIQx9Y07Yt', '2026-04-04T09:45:00Z'),
('hist_04', 'item_04', '4532 **** **** 8821', 'XuETnW8BsB2J6uBRxrq/3WG4pd/mwyM/hs/u3rJu7mo=', 'Tnv+a5fQ9Ts6tkjU', '2026-04-05T09:45:00Z'),
('hist_05', 'item_05', 'backup-codes-root', 'x3QTep0zdLSWUsZGg5yqqgDoMu38tEblmXllN8/UZJc=', 'Dd9UZyNHfY5u2fev', '2026-04-06T09:45:00Z'),
('hist_06', 'item_06', 'BR-99887766', 'JpzIz5+we3Tu1IasjKuAdBxwgMlzZ4bV2QPcZdFht8Q=', '5KKu6DSeqwS2nKVV', '2026-04-07T09:45:00Z'),
('hist_07', 'item_07', 'infra@riskzero.dev', 'xTLsZJ6O7mqPzEhuzpDwn5+ZetkB+FAOKmAZlxJMna4=', 'tGc8stF/LSjTppXN', '2026-04-08T09:45:00Z'),
('hist_08', 'item_08', 'nikolas.melo@riskzero.dev', '8I90/FjxFjqrIXK5M35R8NFrw7ViHuPRrkGcqOBzdU4=', 'cfgdEdLoODBCsMOb', '2026-04-09T09:45:00Z'),
('hist_09', 'item_09', '5412 **** **** 3390', 'SNUB8e4jOnRvzi+sBVtyAqL2bIie4V0d/LWbs/iMolM=', 'lEsU8GI1GUrZ/Lev', '2026-04-10T09:45:00Z'),
('hist_10', 'item_10', 'root@203.0.113.42', 'sRjYnI/YzAYEIh0QzrVu+Eg+Hdp7pUzKanfaDuITMVs=', 'gEgNaxhWhHkdpA3I', '2026-04-11T09:45:00Z'),
('hist_11', 'item_11', 'carla.mendes@gmail.com', '4DMLiuG98CzEaEg5BHCLkUtS7YC6aTryuhUj6rqg2yc=', 'm5NfkzO0sGz+xbIz', '2026-04-12T09:45:00Z'),
('hist_12', 'item_12', 'daniel.souza.sec', 'uuRRw5XLoKYf5gTJehj8p02+bgrMp6KMR0DWXM5XNrA=', 'nYmt6OhqsdU92NFG', '2026-04-13T09:45:00Z'),
('hist_13', 'item_13', '12.345.678/0001-90', 'KrZ8W/ev3IprArh0NcgyMbj+c9w831v6xxg/bE7wrB0=', 'eBRElDFijrAT4ca4', '2026-04-14T09:45:00Z'),
('hist_14', 'item_14', 'SP-506987412', 'uukau1wIW+vglqmlna8BXl/Y3apsz+d77jADeFzm9MU=', '3R6kaz5thvjtwcuP', '2026-04-15T09:45:00Z'),
('hist_15', 'item_15', 'admin@riskzero.dev', 'avHI87CXrqe1+KufvE7kjQnrHQOp/ZSE4nVki0/OWS8=', 'x3YRSG/pTynAIChY', '2026-04-16T09:45:00Z'),
('hist_16', 'item_16', 'felipe.rocha.compras', '8GxNUz0X2kqhtA62vVUXrOO5q/AVU1wlM9Ja3QCujk4=', 'wmftWG5Efq5L2lfN', '2026-04-17T09:45:00Z'),
('hist_17', 'item_17', '4984 **** **** 1104', 'axGnNhzNjZZAfmwWpJO4s63WuRQqcGrm9VCNgOkB2c8=', 'FKmv+g2k/dWjqeQS', '2026-04-18T09:45:00Z'),
('hist_18', 'item_18', 'ledger-vault-01', 'IQjH5mxIjIyzk+YXDUzSHwDhU5Sx/Prg9G6LN+Wo7yA=', 'Cs5OA5dPr9iGF6sI', '2026-04-19T09:45:00Z'),
('hist_19', 'item_19', 'ra20261045', '+54DQNnZpiB3dSC+pIKNAO6VX/2CZsGKXvxX3zlT1og=', 'LPKx59opkP+Srt8V', '2026-04-20T09:45:00Z'),
('hist_20', 'item_20', 'rk_live_prod_key', 'yWLmrzdHIRUG5T0BPlCNEs0/b73oRwznKSzocRqP70c=', '6FQL04qBWtPf/H6d', '2026-04-21T09:45:00Z'),
('hist_21', 'item_21', 'yasmin.sec', 'arLT5zZEqvxQXToPY50J+5D8Y7OkmhIXmgttk+UUxJs=', '8E7ydKcvSikM+r2q', '2026-04-22T09:45:00Z'),
('hist_22', 'item_22', 'matheus.araujo', 'snrOX7s13pxeXfSby7YKNxiUalcNbjyZqIRPMjh6oWM=', 'rUEldetF/v6HP/MC', '2026-04-23T09:45:00Z');

-- 5. Inserção de 22 registros em logs_auditoria
INSERT INTO logs_auditoria (id, user_id, timestamp, action, details) VALUES
('log_01', 'usr_01_ana_silva', '2026-06-02T10:02:00Z', 'LOGIN_SUCCESS', 'Autenticação concluída com derivação Argon2id local.'),
('log_02', 'usr_02_bruno_costa', '2026-06-03T10:04:00Z', '2FA_VERIFIED', 'Código TOTP RFC 6238 validado com sucesso.'),
('log_03', 'usr_03_carla_mendes', '2026-06-04T10:06:00Z', 'CREDENTIAL_CREATED', 'Nova credencial cifrada com AES-GCM 256 adicionada ao cofre.'),
('log_04', 'usr_04_daniel_souza', '2026-06-05T10:08:00Z', 'PASSWORD_COPIED', 'Senha copiada para área de transferência com auto-limpeza de 30s.'),
('log_05', 'usr_05_eduarda_lima', '2026-06-06T10:10:00Z', 'VAULT_HEALTH_CHECK', 'Auditoria de força e reutilização de senhas concluída.'),
('log_06', 'usr_06_felipe_rocha', '2026-06-07T10:12:00Z', 'VPN_CONNECTED', 'Túnel WireGuard Curve25519 estabelecido sem vazamento DNS.'),
('log_07', 'usr_07_gabriela_alves', '2026-06-08T10:14:00Z', 'AUTO_LOCK', 'Cofre bloqueado automaticamente após perda de foco da aba.'),
('log_08', 'usr_08_henrique_dias', '2026-06-09T10:16:00Z', 'PIN_LOCKED', 'Bloqueio rápido por PIN de 6 dígitos ativado pelo usuário.'),
('log_09', 'usr_09_isabela_nunes', '2026-06-10T10:18:00Z', 'CREDENTIAL_UPDATED', 'Senha rotacionada e versão anterior salva no histórico.'),
('log_10', 'usr_10_joao_pedro', '2026-06-11T10:20:00Z', 'BACKUP_EXPORTED', 'Backup criptografado (.riskzero) exportado localmente.'),
('log_11', 'usr_11_karina_martins', '2026-06-12T10:22:00Z', 'BREACH_DETECTED', 'Verificação k-Anonymity HIBP identificou senha exposta.'),
('log_12', 'usr_12_lucas_ferreira', '2026-06-13T10:24:00Z', 'DEK_ROTATED', 'Chave DEK de 256 bits rotacionada e re-encapsulada.'),
('log_13', 'usr_13_mariana_gomes', '2026-06-14T10:26:00Z', 'SUBSCRIPTION_UPGRADED', 'Plano atualizado para PRO com sincronização em nuvem.'),
('log_14', 'usr_14_nikolas_melo', '2026-06-15T10:28:00Z', 'SCREENSHOT_BLOCKED', 'Tentativa de captura de tela bloqueada por política de privacidade.'),
('log_15', 'usr_15_olivia_santos', '2026-06-16T10:30:00Z', 'VPN_DISCONNECTED', 'Túnel WireGuard encerrado manualmente pelo usuário.'),
('log_16', 'usr_16_paulo_ribeiro', '2026-06-17T10:32:00Z', 'LOGIN_FAILED', 'Tentativa de desbloqueio com senha mestra inválida.'),
('log_17', 'usr_17_rafaela_castro', '2026-06-18T10:34:00Z', 'VAULT_IMPORTED', 'Importação de credenciais concluída e cifrada em memória.'),
('log_18', 'usr_18_samuel_oliveira', '2026-06-19T10:36:00Z', 'SESSION_INVALIDATED', 'Sessão remota antiga encerrada pelo painel de dispositivos.'),
('log_19', 'usr_19_tatiana_barros', '2026-06-20T10:38:00Z', 'VPN_KILLSWITCH_TRIGGERED', 'Kill Switch bloqueou tráfego fora do túnel WireGuard.'),
('log_20', 'usr_20_vinicius_cardoso', '2026-06-21T10:40:00Z', 'CREDENTIAL_DELETED', 'Credencial removida do cofre e sincronizada.'),
('log_21', 'usr_21_yasmin_pereira', '2026-06-22T10:42:00Z', 'LOGOUT', 'Sessão encerrada e chaves Zero-Knowledge zeradas da RAM.'),
('log_22', 'usr_22_matheus_araujo', '2026-06-23T10:44:00Z', 'VPN_IP_VERIFICATION_FAILED', 'Divergência de IP externo detectada na checagem pós-conexão.');

-- 6. Inserção de 22 registros em servidores_vpn
INSERT INTO servidores_vpn (id, name, country, city, flag, endpoint, port, server_public_key, client_address, status, is_custom, ping) VALUES
('vpn_01_br_sp', 'Brasil - São Paulo 01', 'Brasil', 'São Paulo', '🇧🇷', 'sp01.vpn.riskzero.dev', 51820, 'M29g2qNko82Q6c8RIlbAkYzz0WTwmRWADpriEXWlC0E=', '10.14.0.2/32', 'AVAILABLE', FALSE, 18),
('vpn_02_br_rj', 'Brasil - Rio de Janeiro', 'Brasil', 'Rio de Janeiro', '🇧🇷', 'rj01.vpn.riskzero.dev', 51820, 'zac8+7z/RUr88eVoxFn4Dhv+4WqVCIIObJH8o3Jg/Iw=', '10.14.0.3/32', 'AVAILABLE', FALSE, 24),
('vpn_03_us_ny', 'EUA - Nova York', 'Estados Unidos', 'Nova York', '🇺🇸', 'ny01.vpn.riskzero.dev', 51820, 'ruvsBcyoRVLj9UdYw4DvyxTA+lawv2Aeo04KqV6C+0w=', '10.14.0.4/32', 'AVAILABLE', FALSE, 112),
('vpn_04_us_miami', 'EUA - Miami', 'Estados Unidos', 'Miami', '🇺🇸', 'mia01.vpn.riskzero.dev', 51820, 'KquVG9g+TS6cbS7xxOv++rUV2gL/V0TPA52EmXr5wrE=', '10.14.0.5/32', 'AVAILABLE', FALSE, 96),
('vpn_05_de_fra', 'Alemanha - Frankfurt', 'Alemanha', 'Frankfurt', '🇩🇪', 'fra01.vpn.riskzero.dev', 51820, 'OZXDFDMfnJr+UmN1poBGYU9wjrNPC7+vVt++2xjtj28=', '10.14.0.6/32', 'AVAILABLE', FALSE, 165),
('vpn_06_nl_ams', 'Holanda - Amsterdã', 'Holanda', 'Amsterdã', '🇳🇱', 'ams01.vpn.riskzero.dev', 51820, 'uVG63FI6KKoFXv8ZDhsAGPD2wcJlbbhj+ZaoJ4OsdFI=', '10.14.0.7/32', 'AVAILABLE', FALSE, 171),
('vpn_07_ch_zrh', 'Suíça - Zurique', 'Suíça', 'Zurique', '🇨🇭', 'zrh01.vpn.riskzero.dev', 51820, 'kDOZwdrIs2H15X0Qo1/PcQeQOE/ObAjJiN0A0QHbYM0=', '10.14.0.8/32', 'AVAILABLE', FALSE, 178),
('vpn_08_uk_lon', 'Reino Unido - Londres', 'Reino Unido', 'Londres', '🇬🇧', 'lon01.vpn.riskzero.dev', 51820, 'vDAVF2ZqAmoUT25iTo+vX/5sxt0u1rab96z8LbZsukM=', '10.14.0.9/32', 'AVAILABLE', FALSE, 159),
('vpn_09_fr_par', 'França - Paris', 'França', 'Paris', '🇫🇷', 'par01.vpn.riskzero.dev', 51820, 'OzacaaN2amsXckTBWduLrwk/DyD8Cn8PdxRQZ4mCk4Q=', '10.14.0.10/32', 'AVAILABLE', FALSE, 168),
('vpn_10_ca_tor', 'Canadá - Toronto', 'Canadá', 'Toronto', '🇨🇦', 'tor01.vpn.riskzero.dev', 51820, 'zyTzEm7PtMnrQIHLmpm0bmk2MveEwtxqU5cVyib1Mpg=', '10.14.0.11/32', 'AVAILABLE', FALSE, 121),
('vpn_11_jp_tyo', 'Japão - Tóquio', 'Japão', 'Tóquio', '🇯🇵', 'tyo01.vpn.riskzero.dev', 51820, 'sZhjtLx6ua/ye+vEFUcY32C30oyYC5nhPBI4HoIQtkE=', '10.14.0.12/32', 'AVAILABLE', FALSE, 245),
('vpn_12_sg_sin', 'Singapura', 'Singapura', 'Singapura', '🇸🇬', 'sin01.vpn.riskzero.dev', 51820, 'iO7S68OUVSxGJWOVHHEwgmxx3x6Fuqh85Z11V+l2rQ4=', '10.14.0.13/32', 'AVAILABLE', FALSE, 260),
('vpn_13_pt_lis', 'Portugal - Lisboa', 'Portugal', 'Lisboa', '🇵🇹', 'lis01.vpn.riskzero.dev', 51820, 'ZRH3oC8gu3/MLwT4L59GCrG8C97XWVCzBRVg1TEVybQ=', '10.14.0.14/32', 'AVAILABLE', FALSE, 148),
('vpn_14_es_mad', 'Espanha - Madri', 'Espanha', 'Madri', '🇪🇸', 'mad01.vpn.riskzero.dev', 51820, 'Xt6JQw6dUNaUeT3fW99zZm9hs4g1PbsgKjy1f8WiHcU=', '10.14.0.15/32', 'MAINTENANCE', FALSE, 155),
('vpn_15_ar_bue', 'Argentina - Buenos Aires', 'Argentina', 'Buenos Aires', '🇦🇷', 'bue01.vpn.riskzero.dev', 51820, 'yu41fz2eNv3FqfZozzUfnzcbkaQONL9hozFokpNQ2nI=', '10.14.0.16/32', 'AVAILABLE', FALSE, 42),
('vpn_16_cl_scl', 'Chile - Santiago', 'Chile', 'Santiago', '🇨🇱', 'scl01.vpn.riskzero.dev', 51820, 'y0I2oQxfRp6qQ9U3o2g1/Ueu76PJSfnctsEGhu1hAvc=', '10.14.0.17/32', 'AVAILABLE', FALSE, 54),
('vpn_17_au_syd', 'Austrália - Sydney', 'Austrália', 'Sydney', '🇦🇺', 'syd01.vpn.riskzero.dev', 51820, 'nW/EnHlSVUHEKGix3dmr7QDCe1otKjBpxm94AOAuqrM=', '10.14.0.18/32', 'AVAILABLE', FALSE, 278),
('vpn_18_se_sto', 'Suécia - Estocolmo', 'Suécia', 'Estocolmo', '🇸🇪', 'sto01.vpn.riskzero.dev', 51820, 'LpqWARATm6oUe52spL9P1E0E3bioguI1OWiA3lsv7qI=', '10.14.0.19/32', 'AVAILABLE', FALSE, 189),
('vpn_19_is_rek', 'Islândia - Reykjavik', 'Islândia', 'Reykjavik', '🇮🇸', 'rek01.vpn.riskzero.dev', 51820, 'S07l5ntU/HiJtQI2jODKpjk0LmpDO80RMayvGkyNWW4=', '10.14.0.20/32', 'AVAILABLE', FALSE, 205),
('vpn_20_cf_warp', 'Cloudflare WARP Anycast', 'Global', 'Edge Anycast', '☁️', 'engage.cloudflareclient.com', 2408, 'J3h1fh5+ufnsvE37Zm2cy3rFJLIhbozhxFn98MCEK9Y=', '10.14.0.21/32', 'AVAILABLE', FALSE, 14),
('vpn_21_vps_tcc', 'VPS Privada TCC (Ubuntu)', 'Brasil', 'Campinas', '🛡️', '203.0.113.42', 51820, 'U/iE2yqxCYP0rxlioCGgllVzjK1VJ856PM9R9hXvzOw=', '10.14.0.22/32', 'AVAILABLE', TRUE, 21),
('vpn_22_lab_sec', 'Nó Laboratório Homologação', 'Brasil', 'Curitiba', '🔒', '198.51.100.15', 51821, 'VAIAnepaxENGwzC5tLwcJ77MBVM17aw7hM5NRpPJu84=', '10.14.0.23/32', 'UNAVAILABLE', TRUE, 35);

-- 7. Inserção de 22 registros em assinaturas_planos
INSERT INTO assinaturas_planos (id, user_id, tier, billing_cycle, status, started_at, expires_at, auto_renew, payment_method) VALUES
('sub_01', 'usr_01_ana_silva', 'ULTRA', 'ANNUAL', 'ACTIVE', '2026-01-02T00:00:00Z', '2026-12-31T23:59:59Z', TRUE, 'CREDIT_CARD'),
('sub_02', 'usr_02_bruno_costa', 'PRO', 'MONTHLY', 'ACTIVE', '2026-01-03T00:00:00Z', '2026-12-01T23:59:59Z', TRUE, 'PIX'),
('sub_03', 'usr_03_carla_mendes', 'FREE', 'MONTHLY', 'ACTIVE', '2026-01-04T00:00:00Z', NULL, FALSE, NULL),
('sub_04', 'usr_04_daniel_souza', 'PRO', 'ANNUAL', 'TRIAL', '2026-01-05T00:00:00Z', '2026-11-30T23:59:59Z', FALSE, 'CREDIT_CARD'),
('sub_05', 'usr_05_eduarda_lima', 'ULTRA', 'MONTHLY', 'EXPIRED', '2026-01-06T00:00:00Z', '2026-10-01T23:59:59Z', FALSE, 'PIX'),
('sub_06', 'usr_06_felipe_rocha', 'ULTRA', 'ANNUAL', 'ACTIVE', '2026-01-07T00:00:00Z', '2026-12-31T23:59:59Z', TRUE, 'CREDIT_CARD'),
('sub_07', 'usr_07_gabriela_alves', 'PRO', 'MONTHLY', 'ACTIVE', '2026-01-08T00:00:00Z', '2026-12-01T23:59:59Z', TRUE, 'PIX'),
('sub_08', 'usr_08_henrique_dias', 'FREE', 'MONTHLY', 'ACTIVE', '2026-01-09T00:00:00Z', NULL, FALSE, NULL),
('sub_09', 'usr_09_isabela_nunes', 'PRO', 'ANNUAL', 'TRIAL', '2026-01-10T00:00:00Z', '2026-11-30T23:59:59Z', FALSE, 'CREDIT_CARD'),
('sub_10', 'usr_10_joao_pedro', 'ULTRA', 'MONTHLY', 'EXPIRED', '2026-01-11T00:00:00Z', '2026-10-01T23:59:59Z', FALSE, 'PIX'),
('sub_11', 'usr_11_karina_martins', 'ULTRA', 'ANNUAL', 'ACTIVE', '2026-01-12T00:00:00Z', '2026-12-31T23:59:59Z', TRUE, 'CREDIT_CARD'),
('sub_12', 'usr_12_lucas_ferreira', 'PRO', 'MONTHLY', 'ACTIVE', '2026-01-13T00:00:00Z', '2026-12-01T23:59:59Z', TRUE, 'PIX'),
('sub_13', 'usr_13_mariana_gomes', 'FREE', 'MONTHLY', 'ACTIVE', '2026-01-14T00:00:00Z', NULL, FALSE, NULL),
('sub_14', 'usr_14_nikolas_melo', 'PRO', 'ANNUAL', 'TRIAL', '2026-01-15T00:00:00Z', '2026-11-30T23:59:59Z', FALSE, 'CREDIT_CARD'),
('sub_15', 'usr_15_olivia_santos', 'ULTRA', 'MONTHLY', 'EXPIRED', '2026-01-16T00:00:00Z', '2026-10-01T23:59:59Z', FALSE, 'PIX'),
('sub_16', 'usr_16_paulo_ribeiro', 'ULTRA', 'ANNUAL', 'ACTIVE', '2026-01-17T00:00:00Z', '2026-12-31T23:59:59Z', TRUE, 'CREDIT_CARD'),
('sub_17', 'usr_17_rafaela_castro', 'PRO', 'MONTHLY', 'ACTIVE', '2026-01-18T00:00:00Z', '2026-12-01T23:59:59Z', TRUE, 'PIX'),
('sub_18', 'usr_18_samuel_oliveira', 'FREE', 'MONTHLY', 'ACTIVE', '2026-01-19T00:00:00Z', NULL, FALSE, NULL),
('sub_19', 'usr_19_tatiana_barros', 'PRO', 'ANNUAL', 'TRIAL', '2026-01-20T00:00:00Z', '2026-11-30T23:59:59Z', FALSE, 'CREDIT_CARD'),
('sub_20', 'usr_20_vinicius_cardoso', 'ULTRA', 'MONTHLY', 'EXPIRED', '2026-01-21T00:00:00Z', '2026-10-01T23:59:59Z', FALSE, 'PIX'),
('sub_21', 'usr_21_yasmin_pereira', 'ULTRA', 'ANNUAL', 'ACTIVE', '2026-01-22T00:00:00Z', '2026-12-31T23:59:59Z', TRUE, 'CREDIT_CARD'),
('sub_22', 'usr_22_matheus_araujo', 'PRO', 'MONTHLY', 'ACTIVE', '2026-01-23T00:00:00Z', '2026-12-01T23:59:59Z', TRUE, 'PIX');

-- 8. Inserção de 22 registros em sessoes_ativas
INSERT INTO sessoes_ativas (id, user_id, device_name, last_active, ip_placeholder) VALUES
('sess_01', 'usr_01_ana_silva', 'Chrome 130 - Ubuntu 24.04', '2026-06-02T18:03:00Z', '189.40.11.21 (IP Mascarado)'),
('sess_02', 'usr_02_bruno_costa', 'RiskZero Mobile - Pixel 8 Pro (Android 15)', '2026-06-03T18:06:00Z', '10.14.0.3 (Túnel WireGuard Protegido)'),
('sess_03', 'usr_03_carla_mendes', 'Firefox 132 - Windows 11', '2026-06-04T18:09:00Z', '189.40.13.23 (IP Mascarado)'),
('sess_04', 'usr_04_daniel_souza', 'Edge 130 - macOS Sequoia', '2026-06-05T18:12:00Z', '10.14.0.5 (Túnel WireGuard Protegido)'),
('sess_05', 'usr_05_eduarda_lima', 'Brave 1.71 - Arch Linux', '2026-06-06T18:15:00Z', '189.40.15.25 (IP Mascarado)'),
('sess_06', 'usr_06_felipe_rocha', 'RiskZero Mobile - Galaxy S24 (Android 14)', '2026-06-07T18:18:00Z', '10.14.0.7 (Túnel WireGuard Protegido)'),
('sess_07', 'usr_07_gabriela_alves', 'Chrome 130 - Windows 11', '2026-06-08T18:21:00Z', '189.40.17.27 (IP Mascarado)'),
('sess_08', 'usr_08_henrique_dias', 'Safari 18 - macOS Sonoma', '2026-06-09T18:24:00Z', '10.14.0.9 (Túnel WireGuard Protegido)'),
('sess_09', 'usr_09_isabela_nunes', 'RiskZero Extension MV3 - Chrome', '2026-06-10T18:27:00Z', '189.40.19.29 (IP Mascarado)'),
('sess_10', 'usr_10_joao_pedro', 'Firefox 132 - Fedora 41', '2026-06-11T18:30:00Z', '10.14.0.11 (Túnel WireGuard Protegido)'),
('sess_11', 'usr_11_karina_martins', 'RiskZero Mobile - Motorola Edge 50', '2026-06-12T18:33:00Z', '189.40.21.31 (IP Mascarado)'),
('sess_12', 'usr_12_lucas_ferreira', 'Chrome 130 - macOS Sequoia', '2026-06-13T18:36:00Z', '10.14.0.13 (Túnel WireGuard Protegido)'),
('sess_13', 'usr_13_mariana_gomes', 'Vivaldi 7.0 - Ubuntu 24.04', '2026-06-14T18:39:00Z', '189.40.23.33 (IP Mascarado)'),
('sess_14', 'usr_14_nikolas_melo', 'RiskZero Mobile - Xiaomi 14 (Android 14)', '2026-06-15T18:42:00Z', '10.14.0.15 (Túnel WireGuard Protegido)'),
('sess_15', 'usr_15_olivia_santos', 'Edge 130 - Windows 11', '2026-06-16T18:45:00Z', '189.40.25.35 (IP Mascarado)'),
('sess_16', 'usr_16_paulo_ribeiro', 'Opera 114 - Windows 10', '2026-06-17T18:48:00Z', '10.14.0.17 (Túnel WireGuard Protegido)'),
('sess_17', 'usr_17_rafaela_castro', 'Chrome 130 - Debian 12', '2026-06-18T18:51:00Z', '189.40.27.37 (IP Mascarado)'),
('sess_18', 'usr_18_samuel_oliveira', 'RiskZero Mobile - Zenfone 11', '2026-06-19T18:54:00Z', '10.14.0.19 (Túnel WireGuard Protegido)'),
('sess_19', 'usr_19_tatiana_barros', 'Firefox 132 - macOS Sequoia', '2026-06-20T18:57:00Z', '189.40.29.39 (IP Mascarado)'),
('sess_20', 'usr_20_vinicius_cardoso', 'Chrome 130 - Chromebook', '2026-06-21T18:00:00Z', '10.14.0.21 (Túnel WireGuard Protegido)'),
('sess_21', 'usr_21_yasmin_pereira', 'RiskZero Extension MV3 - Edge', '2026-06-22T18:03:00Z', '189.40.31.41 (IP Mascarado)'),
('sess_22', 'usr_22_matheus_araujo', 'RiskZero Mobile - Galaxy A55 (Android 14)', '2026-06-23T18:06:00Z', '10.14.0.23 (Túnel WireGuard Protegido)');

-- =============================================================================
-- CONSULTA DE VERIFICAÇÃO DE QUANTIDADE DE REGISTROS (>= 20 POR TABELA)
-- =============================================================================
SELECT 'usuarios_perfil' AS tabela, COUNT(*) AS total_registros FROM usuarios_perfil
UNION ALL SELECT 'cofre_envelope', COUNT(*) FROM cofre_envelope
UNION ALL SELECT 'cofre_itens', COUNT(*) FROM cofre_itens
UNION ALL SELECT 'historico_senhas', COUNT(*) FROM historico_senhas
UNION ALL SELECT 'logs_auditoria', COUNT(*) FROM logs_auditoria
UNION ALL SELECT 'servidores_vpn', COUNT(*) FROM servidores_vpn
UNION ALL SELECT 'assinaturas_planos', COUNT(*) FROM assinaturas_planos
UNION ALL SELECT 'sessoes_ativas', COUNT(*) FROM sessoes_ativas;
