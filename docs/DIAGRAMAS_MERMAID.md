# Diagramas do Projeto SeguranApp (RiskZero) em Mermaid.js

Este documento reúne a especificação visual e lógica dos diagramas do Trabalho de Conclusão de Curso em sintaxe padrão Mermaid.js. Podem ser visualizados no GitHub, VS Code ou renderizados em PNG/SVG através do [Mermaid Live Editor](https://mermaid.live).

---

## 1. Diagrama de Arquitetura do Sistema e Fluxo de Dados

```mermaid
graph TD
    subgraph "Camada de Apresentação (Cliente)"
        A1["📱 App Mobile Android<br/>(Capacitor 6 + Ionic React)"]
        A2["💻 Web Application<br/>(React 19 + Tailwind v4)"]
        A3["🧩 Extensão de Navegador<br/>(Chrome Manifest V3)"]
    end

    subgraph "Camada de Segurança Local (Client-Side)"
        B1["🔐 Web Crypto API<br/>(AES-GCM 256 / PBKDF2)"]
        B2["🛡️ Android Keystore & Biometrics<br/>(WebAuthn / BiometricPrompt)"]
        B3["⏱️ RFC 6238 TOTP Engine<br/>(Gerador 2FA Local)"]
        B4["🔍 Motor Heurístico Anti-Phishing<br/>(Threat Score Calculator)"]
        B5["🔒 Privacy Screen & Clipboard<br/>(FLAG_SECURE / Auto-Clear 30s)"]
    end

    subgraph "Camada de Rede Segura e Túneis"
        C1["🌐 VPS Linux Ubuntu 22.04 LTS<br/>(WireGuard Server / UDP 51820)"]
        C2["☁️ Cloudflare WARP Edge Network<br/>(Anycast WireGuard Route)"]
        C3["🛡️ Resolvedores DNS Criptografados<br/>(1.1.1.1 / Quad9 Anti-Leak)"]
    end

    subgraph "Serviços Externos e Nuvem Zero-Knowledge"
        D1["☁️ Firebase Cloud Firestore<br/>(Armazenamento Cifrado por UID)"]
        D2["🔑 Firebase Authentication<br/>(Gestão de Sessão do Usuário)"]
        D3["🔎 HaveIBeenPwned API<br/>(k-Anonymity SHA-1 Prefix Lookup)"]
    end

    %% Conexões Cliente -> Segurança Local
    A1 --> B1
    A1 --> B2
    A1 --> B3
    A1 --> B4
    A1 --> B5
    A2 --> B1
    A2 --> B4
    A3 --> B1
    A3 --> B4

    %% Conexões Segurança Local -> Rede & Nuvem
    B1 -- "Envelopes Cifrados (Ciphertext + IV)" --> D1
    A1 -- "Autenticação de Usuário" --> D2
    A1 -- "Túnel WireGuard Curve25519" --> C1
    A1 -- "Alternativa WARP WireGuard" --> C2
    C1 --> C3
    B4 -- "Consulta k-Anonymity (5 primeiros chars SHA-1)" --> D3
```

---

## 2. Diagrama Entidade-Relacionamento (DER Lógico)

```mermaid
erDiagram
    USUARIOS_PERFIL ||--|| COFRE_ENVELOPE : "possui"
    USUARIOS_PERFIL ||--o{ LOGS_AUDITORIA : "gera"
    USUARIOS_PERFIL ||--o{ SESSOES_ATIVAS : "mantém"
    USUARIOS_PERFIL ||--o| ASSINATURAS_PLANOS : "assina"
    COFRE_ENVELOPE ||--o{ COFRE_ITENS : "contém"
    COFRE_ITENS ||--o{ HISTORICO_SENHAS : "registra"
    USUARIOS_PERFIL ||--o{ SERVIDORES_VPN : "conecta"

    USUARIOS_PERFIL {
        string id PK "Identificador único (UID Firebase)"
        string username "E-mail ou nome de login"
        string salt "Salt aleatório CSPRNG de 16 bytes"
        string kdfAlgorithm "Algoritmo KDF (pbkdf2 ou argon2id)"
        string passwordHash "Hash SHA-256 (senha mestra + salt)"
        string pinHash "Hash SHA-256 do PIN local de 6 dígitos"
        string encryptedTotpSecret "Segredo TOTP cifrado com chave mestra"
        boolean totpEnabled "Status de ativação do 2FA"
        string createdAt "Carimbo de data/hora de criação"
    }

    COFRE_ENVELOPE {
        string id PK "Identificador do cofre"
        string userId FK "Chave estrangeira para USUARIOS_PERFIL"
        int version "Versão do esquema do cofre"
        string encryptedDekCiphertext "Chave DEK (256 bits) cifrada pela KEK"
        string encryptedDekIv "Vetor de inicialização do envelope DEK"
        string updatedAt "Data da última sincronização"
    }

    COFRE_ITENS {
        string id PK "Identificador único do item de credencial"
        string envelopeId FK "Chave estrangeira para COFRE_ENVELOPE"
        string title "Título ou nome do serviço cadastrado"
        string username "Nome de usuário ou e-mail de acesso"
        string encryptedPasswordCiphertext "Senha cifrada com DEK (AES-GCM 256)"
        string encryptedPasswordIv "Vetor de inicialização do item"
        string url "Endereço web ou host do serviço"
        string category "LOGIN, CARD, NOTE, IDENTITY, OTHER"
        string encryptedNotesCiphertext "Notas adicionais cifradas"
        string encryptedNotesIv "Vetor de inicialização das notas"
        string encryptedTotpSecret "Segredo TOTP individual cifrado"
        string updatedAt "Carimbo de data da última modificação"
    }

    HISTORICO_SENHAS {
        string id PK "Identificador da entrada de histórico"
        string itemId FK "Chave estrangeira para COFRE_ITENS"
        string username "Usuário na época da alteração"
        string encryptedPasswordCiphertext "Senha anterior cifrada"
        string encryptedPasswordIv "Vetor de inicialização da senha histórica"
        string updatedAt "Data da substituição da senha"
    }

    LOGS_AUDITORIA {
        string id PK "Identificador do registro de auditoria"
        string userId FK "Chave estrangeira para USUARIOS_PERFIL"
        string timestamp "Carimbo ISO 8601 do evento"
        string action "LOGIN_SUCCESS, VPN_CONNECTED, AUTO_LOCK..."
        string details "Descrição textual do evento de segurança"
    }

    SERVIDORES_VPN {
        string id PK "Identificador do nó de rede WireGuard"
        string name "Nome descritivo (ex: VPS Brasil 01)"
        string country "País do servidor"
        string city "Cidade de localização"
        string flag "Emoji de bandeira do país"
        string endpoint "Endereço IP público ou hostname do servidor"
        int port "Porta UDP de escuta (51820)"
        string serverPublicKey "Chave pública Curve25519 (Base64)"
        string clientAddress "IP do cliente na sub-rede VPN (10.14.0.2/32)"
        string status "AVAILABLE, UNAVAILABLE, MAINTENANCE"
        boolean isCustom "Indica servidor particular cadastrado"
        int ping "Latência média em milissegundos"
    }

    ASSINATURAS_PLANOS {
        string id PK "Identificador do contrato de assinatura"
        string userId FK "Chave estrangeira para USUARIOS_PERFIL"
        string tier "Nível do plano: FREE, PRO, ULTRA"
        string billingCycle "MONTHLY ou ANNUAL"
        string status "ACTIVE, EXPIRED, TRIAL"
        string startedAt "Data de início da vigência"
        string expiresAt "Data de expiração ou null (vitalício)"
        boolean autoRenew "Renovação automática ativada"
        string paymentMethod "PIX ou CREDIT_CARD"
    }

    SESSOES_ATIVAS {
        string id PK "Identificador da sessão ativa"
        string userId FK "Chave estrangeira para USUARIOS_PERFIL"
        string deviceName "Nome do smartphone ou navegador"
        string lastActive "Carimbo de última interação"
        string ipPlaceholder "Indicação de IP protegido ou VPN"
    }
```

---

## 3. Modelo Conceitual (MER Conceitual)

```mermaid
classDiagram
    class USUARIO {
        +ID_Usuario
        +Nome_Acesso
        +Credenciais_Mestras
        +Fator_Biometrico
        +Configuracao_2FA
    }

    class COFRE_SEGURANCA {
        +ID_Cofre
        +Chave_DEK_Cifrada
        +Versao_Estrutural
    }

    class CREDENCIAL {
        +ID_Item
        +Servico
        +Login
        +Senha_Cifrada
        +URL_Destino
        +Categoria
        +Notas_Cifradas
    }

    class HISTORICO_SENHA {
        +ID_Historico
        +Senha_Antiga_Cifrada
        +Data_Alteracao
    }

    class TRILHA_AUDITORIA {
        +ID_Log
        +Data_Hora
        +Tipo_Acao
        +Detalhes_Evento
    }

    class SERVIDOR_VPN {
        +ID_Servidor
        +Host_IP
        +Porta_UDP
        +Chave_Publica_WireGuard
        +Localidade
    }

    class PLANO_ASSINATURA {
        +ID_Plano
        +Nivel_Tier
        +Status_Vigencia
        +Ciclo_Cobranca
    }

    USUARIO "1" -- "1" COFRE_SEGURANCA : gerencia
    COFRE_SEGURANCA "1" -- "*" CREDENCIAL : encapsula
    CREDENCIAL "1" -- "*" HISTORICO_SENHA : rastreia
    USUARIO "1" -- "*" TRILHA_AUDITORIA : audita
    USUARIO "1" -- "*" SERVIDOR_VPN : conecta
    USUARIO "1" -- "1" PLANO_ASSINATURA : contrata
```

---

## 4. Gráfico de Gantt do Cronograma de Sprints

```mermaid
gantt
    title Cronograma de Desenvolvimento Ágil — SeguranApp (RiskZero)
    dateFormat  YYYY-MM-DD
    section Sprint 1: Fundação & UI/UX
    Levantamento de Requisitos e Arquitetura Zero-Knowledge :s1_1, 2026-02-02, 7d
    Prototipação no Figma e Configuração do Repositório :s1_2, 2026-02-09, 7d
    section Sprint 2: Criptografia & Cofre
    Implementação Web Crypto (AES-GCM 256 / PBKDF2) :s2_1, 2026-02-16, 7d
    Desenvolvimento do Cofre e Biometria / PIN :s2_2, 2026-02-23, 7d
    section Sprint 3: Rede & WireGuard VPN
    Provisionamento VPS Linux e Configuração WireGuard :s3_1, 2026-03-02, 7d
    Cliente VPN Android, Chaves Curve25519 e Cloudflare WARP :s3_2, 2026-03-09, 7d
    section Sprint 4: Inteligência & Hardening
    Motor Heurístico Anti-Phishing e Threat Score :s4_1, 2026-03-16, 7d
    Auditoria k-Anonymity HIBP e Privacy Screen FLAG_SECURE :s4_2, 2026-03-23, 7d
    section Sprint 5: Educação & Extensão
    Central de Educação Digital (13 tópicos) e Quiz :s5_1, 2026-03-30, 7d
    Extensão Chrome MV3 e Sistema de Assinaturas SaaS :s5_2, 2026-04-06, 7d
    section Sprint 6: Testes & Monografia
    Testes Automatizados Vitest & Cypress E2E :s6_1, 2026-04-13, 7d
    Auditoria Final e Consolidação Monográfica ABNT :s6_2, 2026-04-20, 7d
```
