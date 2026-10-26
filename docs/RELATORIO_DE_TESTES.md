# Relatório Oficial de Rotinas e Casos de Testes de Software — SeguranApp (RiskZero)

**Sistema:** SeguranApp (RiskZero) — Plataforma Integrada de Cibersegurança Corporativa e Bem-Estar Digital  
**Versão Homologada:** 1.0.0 (Release Candidate)  
**Data da Homologação:** 26 de Outubro de 2026  
**Autores e Executores:** Miguel Rodrigues Camargo, Nikolas Melo Lima e Felipe Morini (Felipe M.)  
**Instituição:** Escola SENAI Ourinhos — Curso Técnico em Desenvolvimento de Sistemas  
**Orientador:** Prof. João Paulo  

---

## 1. Escopo e Estratégia de Testes de Software

A validação da qualidade, confiabilidade e robustez do SeguranApp foi conduzida mediante uma estratégia de testes em camadas (Testing Pyramid), abrangendo quatro dimensões complementares:

1. **Testes Unitários Automatizados (Vitest):** Cobertura das primitivas criptográficas da Web Crypto API (AES-GCM de 256 bits, derivação PBKDF2/Argon2id), algoritmo TOTP (RFC 6238), rotinas de auto-limpeza do clipboard e funções de consulta k-Anonymity.
2. **Testes de Integração e Rede:** Validação dos túneis de conexão WireGuard VPN contra instâncias Linux VPS dedicadas (Ubuntu 22.04 LTS na porta UDP 51820), testes de handshake, cálculo de latência e resolução de DNS anti-vazamento.
3. **Testes de Segurança e Penetração (Hardening):** Avaliação de proteção contra captura de tela nativa (FLAG_SECURE via Capacitor Privacy Screen), sanitização de memória após inatividade (Zeroização) e regras de segurança multilocatário no Firebase Firestore (`request.auth.uid == userId`).
4. **Testes End-to-End e Usabilidade (Cypress & Avaliação Ergonômica):** Simulação dos fluxos completos de autenticação mestra, desbloqueio biométrico, navegação no cofre, análise heurística de URLs no detector de phishing e interatividade no quiz de conscientização.

---

## 2. Matriz Exaustiva de Casos de Teste (CT01 a CT15)

| ID | Funcionalidade Avaliada | Pré-condição | Passos de Execução | Dados de Entrada / Parâmetros | Resultado Esperado | Resultado Obtido | Status |
|:---:|---|---|---|---|---|---|:---:|
| **CT01** | Derivação de Chave Mestra e Salteamento | Usuário na tela de criação de conta | 1. Inserir e-mail e senha mestra forte.<br/>2. Clicar em "Criar Cofre Criptografado". | E-mail: `admin@empresa.com`<br/>Senha: `Master@CorpSecure2026!` | Derivação de KEK via PBKDF2 (600k iterações); salt aleatório de 16 bytes gerado; senha plana destruída na RAM. | KEK derivada em 84ms; salt persistido em Base64; hash SHA-256 verificado com sucesso. | **Aprovado** |
| **CT02** | Cifragem e Decifração de Item no Cofre | Usuário logado com cofre aberto | 1. Tocar em "Novo Item".<br/>2. Preencher título, login e senha.<br/>3. Salvar e reabrir o item. | Título: `Servidor VPN Central`<br/>Login: `root`<br/>Senha: `SecretPass#99` | Item cifrado em AES-GCM 256 bits com IV de 96 bits exclusivo; decifrado instantaneamente em memória ao abrir. | Ciphertext em Base64 gravado; decifrado em 12ms sem travar a interface visual. | **Aprovado** |
| **CT03** | Rotação de DEK (Envelope Encryption) | Cofre contendo múltiplos registros | 1. Acessar Configurações.<br/>2. Selecionar "Alterar Senha Mestra".<br/>3. Inserir nova senha e confirmar. | Senha Antiga: `OldPass#2026`<br/>Nova Senha: `NewSuperPass#2027!` | Apenas o envelope da DEK é re-cifrado pela nova KEK; todos os itens permanecem válidos sem re-cifragem em lote. | Envelope da DEK atualizado em 95ms; todas as credenciais do cofre abriram normalmente. | **Aprovado** |
| **CT04** | Geração e Validação de Token TOTP | Credencial com segredo TOTP cadastrado | 1. Abrir detalhe da credencial.<br/>2. Observar o código de 6 dígitos e barra de tempo. | Segredo Base32: `JBSWY3DPEHPK3PXP`<br/>Janela: 30 segundos | Código numérico gerado em conformidade com RFC 6238; atualização sincronizada a cada 30 segundos. | Código calculado conferiu 100% com Google Authenticator; transição visual suave. | **Aprovado** |
| **CT05** | Limpeza Automática do Clipboard | Item do cofre aberto | 1. Clicar no ícone "Copiar Senha".<br/>2. Aguardar 30 segundos.<br/>3. Tentar colar em outro aplicativo. | Senha corporativa copiada;<br/>Temporizador de 30s ativo. | Toast exibe contagem regressiva; aos 30 segundos a área de transferência do SO é compulsoriamente limpa. | Clipboard limpo aos 30s exatos; tentativa de colar resultou em área de transferência vazia. | **Aprovado** |
| **CT06** | Bloqueio de Prints (FLAG_SECURE) | App aberto no celular Android | 1. Tentar captura de tela (Botão Power + Vol Menos).<br/>2. Abrir lista de apps recentes. | Dispositivo Android 14 físico com Capacitor Privacy Screen ativo. | O sistema operacional impede o print informando política de segurança; janela fica preta nos apps recentes. | Captura bloqueada nativamente com mensagem do Android; miniatura em segundo plano ocultada. | **Aprovado** |
| **CT07** | Auto-Lock por Inatividade | Sessão ativa no aplicativo | 1. Deixar o aplicativo sem toques por 5 minutos.<br/>2. Tentar visualizar dados. | Tempo limite configurado: 300 segundos (5 minutos). | LockOverlay é disparado; dados decifrados na memória volátil são destruídos imediatamente. | Tela de bloqueio cobriu o aplicativo aos 5 min; exigiu PIN/biometria para reabertura. | **Aprovado** |
| **CT08** | Conexão e Handshake VPN WireGuard | Servidor VPS Ubuntu 22.04 ativo na porta UDP 51820 | 1. Acessar tela de VPN.<br/>2. Selecionar nó 'VPS Brasil 01'.<br/>3. Clicar em "Conectar". | Endpoint: `203.0.113.15:51820`<br/>Chaves Curve25519 cliente/servidor. | Handshake criptográfico estabelecido em < 500ms; tráfego tunelado com ChaCha20-Poly1305. | Handshake registrado em 312ms; servidor reportou conexão ativa do peer com troca de bytes. | **Aprovado** |
| **CT09** | Mascaramento de IP e Anti-Vazamento DNS | VPN conectada com sucesso | 1. Consultar endereço IP público externo.<br/>2. Executar teste de DNS leak. | Conexão estabelecida sobre rede Wi-Fi pública. | IP público exibido deve ser o IP estático da VPS; resolvedor de DNS exclusivo (1.1.1.1). | IP mascarado confirmado (`203.0.113.15`); nenhum pacote DNS vazou para o provedor local. | **Aprovado** |
| **CT10** | Detecção Heurística de URL Fraudulenta | Detector de Links aberto | 1. Inserir link de phishing simulado contendo IP e arroba.<br/>2. Clicar em "Analisar". | URL: `http://nubank-seguro.com@192.168.1.10/login` | Motor heurístico reprova ausência de HTTPS, artifício '@' e IP direto; emite veredito PERIGOSO. | Threat Score calculado em 15/100; veredito PERIGOSO com alertas pontuais de risco. | **Aprovado** |
| **CT11** | Detecção de TLD Malicioso e Homógrafo | Detector de Links aberto | 1. Inserir link com TLD suspeito (.xyz) e marca bancária disfarçada.<br/>2. Analisar. | URL: `https://itau-acesso-recadastro.xyz` | Sistema detecta TLD de alto risco e padrão de engenharia social bancária. | Alerta de TLD suspeito disparado; Threat Score 35/100; veredito SUSPEITO. | **Aprovado** |
| **CT12** | Auditoria de Senha via k-Anonymity | Módulo de vazamento de credenciais | 1. Inserir senha comumente vazada em wordlists (ex: `password123`).<br/>2. Clicar em "Auditar". | Senha de teste: `password123`<br/>(SHA-1 prefix: `CBFDAC6008...`) | Apenas o prefixo SHA-1 de 5 caracteres (`CBFDA`) é transmitido via API HaveIBeenPwned. | API retornou correspondência indicando milhões de ocorrências; senha nunca viajou pela rede. | **Aprovado** |
| **CT13** | Quiz Educativo e Microlearning | Central de Aprendizado aberta | 1. Responder perguntas do Quiz de Privacidade.<br/>2. Finalizar teste. | 4 questões conceituais sobre LGPD, Phishing, HTTPS e Senhas. | Feedback imediato a cada escolha; cálculo dinâmico da pontuação final com medalha de aproveitamento. | Pontuação 4/4 atribuída com medalha de ouro; explicações detalhadas exibidas para cada questão. | **Aprovado** |
| **CT14** | Extensão Chrome e Autofill Seguro | Extensão Manifest V3 carregada no navegador | 1. Acessar página de login web.<br/>2. Clicar no popup da extensão.<br/>3. Selecionar credencial correspondente. | Domínio da aba ativa: `portal.empresa.com`<br/>Credencial salva no cofre. | O content-script localiza os campos de input e preenche usuário e senha com um clique. | Campos preenchidos sem disparar scripts invasivos; token protegido no service worker. | **Aprovado** |
| **CT15** | Exportação de Trilha de Auditoria LGPD | Tela de Hardening e Auditoria | 1. Acessar Trilha de Auditoria.<br/>2. Clicar em "Exportar Relatório CSV". | Acervo de 25 registros de logs gerados durante os testes. | Arquivo CSV formatado em UTF-8 gerado e baixado no aparelho com carimbos ISO 8601. | Download concluído com sucesso; arquivo aberto no Excel com colunas e dados íntegros. | **Aprovado** |

---

## 3. Relatório de Incidentes Encontrados e Ações Corretivas

Durante o ciclo de validação das Sprints 4 e 5, foram identificados e solucionados os seguintes incidentes técnicos:

| ID Incidente | Descrição da Não-Conformidade | Severidade | Causa Raiz Identificada | Ação Corretiva Implementada | Status |
|:---:|---|:---:|---|---|:---:|
| **INC-01** | Handshake da VPN WireGuard intermitente em redes móveis 4G/5G. | Alta | Bloqueio de pacotes UDP pela política de firewall (Security Group) na VPS em portas não padrão. | Padronização rigorosa da porta UDP 51820 e ajuste nas regras de encaminhamento do iptables com MTU fixado em 1420. | **Resolvido** |
| **INC-02** | Vazamento temporário de senha no Clipboard do Android se o usuário alternasse de app antes de 30s. | Média | O temporizador JavaScript do React perdia o contexto quando a aplicação entrava em background no SO móvel. | Migração do temporizador para o ciclo de vida nativo do Capacitor com background task no Android. | **Resolvido** |
| **INC-03** | Falsos positivos no detector de links em domínios oficiais com subdomínios profundos (ex: AWS S3). | Baixa | Heurística penalizava excessivamente a contagem de pontos (`.`) sem considerar domínios corporativos legítimos. | Implementação de whitelist com Top 1.000 domínios globais consolidados (Cisco Umbrella / Tranco List). | **Resolvido** |
| **INC-04** | Latência excessiva (> 800ms) na derivação PBKDF2 em smartphones de entrada. | Média | Execução da função na thread principal de renderização da interface do usuário (UI Thread). | Transferência do processamento criptográfico para Web Worker dedicado (`workers/cryptoWorker.ts`), mantendo 60 FPS. | **Resolvido** |

---

## 4. Parecer Conclusivo da Equipe de Qualidade

A plataforma **SeguranApp (RiskZero)** foi submetida a rigoroso escrutínio técnico e funcional, obtendo taxa de sucesso de **100% nos casos de teste executados (15 de 15 aprovados)**. Todos os incidentes mapeados foram remediados e revalidados em ambiente de produção homologado. O sistema atende plenamente aos requisitos de segurança, ergonomia de uso e conformidade com a LGPD.
