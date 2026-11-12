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
- **20 contas limpas povoadas online** no Firebase Authentication e na coleção `users/{uid}` do Cloud Firestore (apenas perfil inicial: `email`, `salt`, `kdfAlgorithm`, `totpEnabled`, `subscription` `FREE`/`ACTIVE` e `createdAt`, sem itens de cofre extras):

| # | E-mail | UID no Firebase |
| :-: | :--- | :--- |
| 01 | `ana.silva@riskzero.dev` | `ZhsjOTswAhRFvfBosR5rP65ZVy63` |
| 02 | `bruno.costa@riskzero.dev` | `fyjgeluSI5S9N45eVfVqwKx6o163` |
| 03 | `carla.mendes@riskzero.dev` | `u7GRfch46bWmMm0fU9jeSYGD9Na2` |
| 04 | `daniel.souza@riskzero.dev` | `XJcmI1M622XEBBwREcYJwbQyYRw1` |
| 05 | `eduarda.lima@riskzero.dev` | `7GKBqMbyURNkjM2Ga0lYaJccP6f1` |
| 06 | `felipe.rocha@riskzero.dev` | `tXIqVaaKamO7Hqvu1emsz7FNsEF2` |
| 07 | `gabriela.alves@riskzero.dev` | `SdEoE5YkVDdj87QrgXp8THHJRHJ2` |
| 08 | `henrique.dias@riskzero.dev` | `9aVjGUF5rHTAcTNtr6ksD1iq3113` |
| 09 | `isabela.nunes@riskzero.dev` | `K72GMCGCPZaBxRHINEslmzM3yOf1` |
| 10 | `joao.pedro@riskzero.dev` | `o6wqxw0KNMRLd5laRFLpeJ7Bk5w2` |
| 11 | `karina.martins@riskzero.dev` | `Kdz3PnQLOnSN9cc8uvkYVNSeUXq1` |
| 12 | `lucas.ferreira@riskzero.dev` | `6sCAj3rIgtSOu3ARIDbXr6MKXLH3` |
| 13 | `mariana.gomes@riskzero.dev` | `z6QR2yYJzhYYepyWYy9sm64qArB3` |
| 14 | `nikolas.melo@riskzero.dev` | `4eU8FDEfJCMevD6xgecv3rsgegp1` |
| 15 | `olivia.santos@riskzero.dev` | `MXSADt9gR4VD4ERasbd5zm6nCFr2` |
| 16 | `paulo.ribeiro@riskzero.dev` | `kktnAjAJMDYcoxLE46iVFqilX4U2` |
| 17 | `rafaela.castro@riskzero.dev` | `FUMNvO6DxNaZxBczrtxMjvt7j7W2` |
| 18 | `samuel.oliveira@riskzero.dev` | `xXanioPYS9YsbFpXLhCXb9C5igz2` |
| 19 | `tatiana.barros@riskzero.dev` | `5SOXO2bRd2fH6QYh3e3gFHAPU5B3` |
| 20 | `vinicius.cardoso@riskzero.dev` | `6SvAoVzQbuNlE6RaZunXNZaqOPN2` |

### 2. Supabase (Execução direta do `.sql` na nuvem)
Para demonstrar o modelo relacional SQL povoado diretamente em nuvem PostgreSQL:
1. Acesse o painel do [Supabase](https://supabase.com) e crie/abra um projeto.
2. No menu lateral, clique em **SQL Editor** → **New query**.
3. Copie e cole todo o conteúdo de [`riskzero_schema_and_seed.sql`](./riskzero_schema_and_seed.sql).
4. Clique em **Run**.
5. Ao final da execução, a consulta `SELECT ... UNION ALL` exibirá a contagem confirmando **22 registros válidos em cada uma das 8 tabelas**.

