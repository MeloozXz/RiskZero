# Banco de Dados Físico e Nuvem — RiskZero (SeguranApp)

Este diretório contém o script SQL físico do sistema **RiskZero**, estruturado para **PostgreSQL / Supabase** e alinhado com o Diagrama Entidade-Relacionamento ([docs/DIAGRAMAS_MERMAID.md](../docs/DIAGRAMAS_MERMAID.md)) e com os tipos da aplicação ([src/types/index.ts](../src/types/index.ts)).

## Arquivos

- [`riskzero_schema_and_seed.sql`](./riskzero_schema_and_seed.sql): Script completo de criação das **8 tabelas** (`CREATE TABLE` com chaves primárias `PK`, chaves estrangeiras `FK`, restrições `CHECK`, `UNIQUE` e índices) seguido do povoamento completo com **22 registros válidos por tabela** (**176 registros no total**, atendendo ao mínimo obrigatório de 20 registros por entidade).

## Estrutura das Entidades

| Tabela | Descrição | Registros |
| :--- | :--- | :---: |
| `usuarios_perfil` | Perfil criptográfico do usuário (`salt`, `kdf_algorithm`, `password_hash`, `pin_hash`, `totp_enabled`) | 22 |
| `cofre_envelope` | Envelope Zero-Knowledge contendo a chave `DEK` cifrada pela `KEK` (relação 1:1 com usuário) | 22 |
| `cofre_itens` | Credenciais, cartões, notas e identidades cifradas com AES-GCM 256 (`ciphertext` + `iv`) | 22 |
| `historico_senhas` | Histórico de versões anteriores de senhas rotacionadas | 22 |
| `logs_auditoria` | Trilha de auditoria de eventos de segurança (`LOGIN_SUCCESS`, `AUTO_LOCK`, `VPN_CONNECTED`, etc.) | 22 |
| `servidores_vpn` | Nós WireGuard (Cloudflare WARP e VPS própria) com chaves públicas Curve25519 | 22 |
| `assinaturas_planos` | Planos (`FREE`, `PRO`, `ULTRA`), ciclos e métodos de pagamento (`PIX`, `CREDIT_CARD`) | 22 |
| `sessoes_ativas` | Dispositivos conectados e mascaramento de IP | 22 |

---

## Operação Online na Nuvem

### 1. Firebase (Em operação no aplicativo)
A aplicação Web/Mobile já opera online utilizando **Firebase Authentication** e **Cloud Firestore** (projeto `securityproject-67800`, definido em [`src/services/firebase.ts`](../src/services/firebase.ts) e [`firebase.json`](../firebase.json)).
- As regras de segurança em [`firestore.rules`](../firestore.rules) garantem isolamento estrito por usuário (`request.auth != null && request.auth.uid == userId`).
- Todos os dados sensíveis trafegam e são armazenados já cifrados pelo cliente (*Zero-Knowledge*).

### 2. Supabase (Execução direta do `.sql` na nuvem)
Para demonstrar o modelo relacional SQL povoado diretamente em nuvem PostgreSQL:
1. Acesse o painel do [Supabase](https://supabase.com) e crie/abra um projeto.
2. No menu lateral, clique em **SQL Editor** → **New query**.
3. Copie e cole todo o conteúdo de [`riskzero_schema_and_seed.sql`](./riskzero_schema_and_seed.sql).
4. Clique em **Run**.
5. Ao final da execução, a consulta `SELECT ... UNION ALL` exibirá a contagem confirmando **22 registros válidos em cada uma das 8 tabelas**.
