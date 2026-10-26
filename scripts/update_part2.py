import os
import sys
import docx
from docx.shared import Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx_helper import (
    get_target_doc_path, get_workspace_target_doc_path,
    add_heading_1, add_heading_2, add_heading_3, add_body_p, add_bullet_p, add_table_data
)

def run_part2():
    target_path = get_target_doc_path()
    workspace_target = get_workspace_target_doc_path()
    
    print(f"[PARTE 2] Carregando documento gerado pela Parte 1: {target_path}")
    doc = docx.Document(target_path)
    
    # Quebra de página antes do Capítulo 3
    doc.add_page_break()
    
    # =========================================================================
    # CAPÍTULO 3: METODOLOGIA E GESTÃO ÁGIL DO PROJETO
    # =========================================================================
    print("[PARTE 2] Injetando Capítulo 3: Metodologia e Gestão Ágil do Projeto...")
    add_heading_1(doc, "3. METODOLOGIA E GESTÃO ÁGIL DO PROJETO")
    
    add_heading_2(doc, "3.1 Abordagem e Enquadramento Metodológico")
    add_body_p(
        doc,
        "A presente investigação científica e tecnológica enquadra-se metodologicamente como uma pesquisa aplicada, "
        "com objetivos exploratórios e abordagem mista (qualitativa e quantitativa). Conforme preconizam Gil (2019) e "
        "Marconi e Lakatos (2021), a pesquisa aplicada tem como propósito primordial a geração de conhecimentos direcionados "
        "à aplicação prática e à solução de problemas concretos vivenciados na sociedade e nas organizações corporativas."
    )
    add_body_p(
        doc,
        "No âmbito deste trabalho, o problema concreto consiste na elevada incidência de violações cibernéticas causadas por "
        "falhas humanas e engenharia social, aliada à carência de instrumentos tecnológicos ergonômicos que integrem defesa "
        "ativa de dados e conscientização contínua. Para materializar a solução, utilizou-se a metodologia de Engenharia de "
        "Software orientada a prototipação evolutiva baseada em métodos ágeis."
    )
    
    add_heading_2(doc, "3.2 Framework Ágil Adotado: Integração Scrum e Kanban")
    add_body_p(
        doc,
        "O desenvolvimento da plataforma SeguranApp (RiskZero) foi estruturado a partir da integração híbrida dos frameworks "
        "ágeis Scrum e Kanban (comumente denominada Scrumban). Essa combinação proporcionou o rigor de planejamento e alinhamento "
        "temporal das iterações quinzenais (Sprints) característicos do Scrum, com a flexibilidade de fluxo visual contínuo e "
        "limitação do trabalho em progresso (Work In Progress - WIP) propiciada pelo Kanban."
    )
    add_body_p(
        doc,
        "Durante o ciclo de vida do projeto, foram realizadas reuniões diárias de alinhamento (Daily Meetings assíncronas), "
        "reuniões de planejamento de sprint (Sprint Planning) a cada início de ciclo para estimativa e priorização de estórias "
        "por meio da técnica de Planning Poker, e reuniões de revisão e retrospectiva (Sprint Review and Retrospective) ao término "
        "de cada entrega quinzenal para avaliação dos artefatos produzidos e refinamento contínuo dos processos de engenharia."
    )
    
    add_heading_2(doc, "3.3 Estrutura, Papéis e Divisão de Responsabilidades da Equipe")
    add_body_p(
        doc,
        "A equipe do projeto é composta pelos acadêmicos Miguel Rodrigues Camargo, Nikolas Melo Lima e Felipe Morini, "
        "sob orientação técnica e pedagógica do Prof. João Paulo. Para assegurar máxima produtividade, evitar gargalos operacionais "
        "e garantir a cobertura holística dos requisitos de software e segurança, as responsabilidades foram divididas conforme "
        "a matriz de papéis apresentada a seguir:"
    )
    
    add_bullet_p(
        doc,
        "Atuou na liderança técnica do núcleo de segurança e redes, concepção da arquitetura de Conhecimento Zero "
        "(Zero-Knowledge), implementação da camada criptográfica Web Crypto API (AES-GCM de 256 bits, PBKDF2-SHA256 e Argon2id), "
        "desenvolvimento do cliente e servidor WireGuard VPN com curva elíptica Curve25519, integração Cloudflare WARP e "
        "definição das regras de negócios das assinaturas SaaS.",
        bold_title="Miguel Rodrigues Camargo (Product Owner & Lead Cryptography Engineer):"
    )
    add_bullet_p(
        doc,
        "Responsável pela arquitetura de interface e experiência do usuário (UI/UX), implementação do aplicativo híbrido "
        "multiplataforma em Ionic React 8, React 19, Vite e Tailwind CSS, integração nativa do Capacitor 6 para Android, "
        "renderização 3D interativa com Spline 3D, desenvolvimento da extensão de navegador (Chrome Manifest V3) e "
        "garantia dos princípios de bem-estar digital e design ergonômico anti-estresse.",
        bold_title="Nikolas Melo Lima (Scrum Master & Mobile/Frontend Architect):"
    )
    add_bullet_p(
        doc,
        "Encarregado da camada de hardening e integridade do dispositivo (bloqueio nativo de capturas de tela com FLAG_SECURE "
        "via Privacy Screen, sanitização automática da área de transferência), auditoria de vazamentos via k-Anonymity HIBP, "
        "mecanismos de compliance com a LGPD e exportação de logs, concepção da suíte de testes unitários (Vitest) e testes "
        "end-to-end (Cypress), além da padronização acadêmica de toda a documentação segundo as normas ABNT.",
        bold_title="Felipe Morini (Lead QA, Hardening & Compliance Engineer):"
    )
    
    add_heading_2(doc, "3.4 Gestão de Tarefas e Governança de Código no GitHub")
    add_body_p(
        doc,
        "A governança do projeto foi operacionalizada através de um repositório centralizado no GitHub, utilizando o GitHub Projects "
        "como quadro Kanban automatizado. O fluxo de trabalho foi segmentado nas raias: Backlog do Produto, A Fazer (Sprint Backlog), "
        "Em Desenvolvimento, Em Revisão de Código / Testes (Code Review / QA) e Concluído (Done)."
    )
    add_body_p(
        doc,
        "Para a gestão das ramificações de código, adotou-se o modelo Git Flow simplificado. A branch 'main' foi estritamente "
        "preservada para versões estáveis de produção. O desenvolvimento diário ocorreu na branch 'develop', e cada nova funcionalidade "
        "ou correção foi elaborada em branches isoladas (prefixadas como 'feature/' ou 'fix/'). Nenhuma mesclagem para as branches "
        "principais foi permitida sem a abertura de Pull Requests formais, exigindo a aprovação de pelo menos um membro revisor "
        "e a execução bem-sucedida das rotinas de integração contínua (CI) e testes automatizados."
    )
    
    add_heading_2(doc, "3.5 Product Backlog Completo (User Stories)")
    add_body_p(
        doc,
        "O Backlog do Produto foi concebido a partir do levantamento detalhado das necessidades dos usuários corporativos, "
        "administradores de rede e colaboradores em regime de trabalho remoto. A priorização seguiu o método MoSCoW "
        "(Must-have, Should-have, Could-have, Won't-have) e a complexidade relativa foi estimada em Story Points (SP) através "
        "da sequência de Fibonacci, conforme detalhado na Tabela 1:"
    )
    
    # TABELA 1: PRODUCT BACKLOG
    backlog_headers = ["ID", "Épico", "Estória de Usuário (User Story)", "Critérios de Aceitação", "Prioridade", "SP"]
    backlog_rows = [
        [
            "US01",
            "Autenticação & Cofre",
            "Como colaborador corporativo, quero criar uma conta com Senha Mestra salteada, para que apenas eu tenha a chave de abertura do meu cofre.",
            "Criptografia local via PBKDF2 (600k iterações); salteamento criptográfico CSPRNG de 16 bytes; senha mestra nunca enviada em texto claro à nuvem.",
            "Must",
            "8"
        ],
        [
            "US02",
            "Autenticação & Cofre",
            "Como usuário móvel, quero desbloquear o aplicativo via biometria (impressão digital ou FaceID), para acessar minhas credenciais com rapidez e segurança.",
            "Integração nativa com Android BiometricPrompt e WebAuthn; chave biométrica atrelada ao hardware seguro; opção de fallback por PIN de 6 dígitos.",
            "Must",
            "5"
        ],
        [
            "US03",
            "Autenticação & Cofre",
            "Como colaborador, quero gerar e validar tokens de segundo fator (2FA/TOTP) diretamente no app, para não depender de SMS vulneráveis.",
            "Geração RFC 6238 HMAC-SHA1; janelas de 30 segundos; segredo compartilhado cifrado com a chave mestra no cofre.",
            "Must",
            "5"
        ],
        [
            "US04",
            "Gestão de Credenciais",
            "Como profissional, quero cadastrar, categorizar e buscar credenciais corporativas no cofre, para manter minhas senhas organizadas.",
            "Cifragem AES-GCM 256 bits com IV exclusivo por item; categorização por Login, Cartão, Nota e Identidade; busca instantânea em memória decifrada.",
            "Must",
            "8"
        ],
        [
            "US05",
            "Gestão de Credenciais",
            "Como usuário, quero que senhas copiadas sejam limpas automaticamente da área de transferência após 30 segundos, para impedir espionagem por outros apps.",
            "Temporizador regressivo visual de 30s no toast; limpeza compulsória do clipboard do sistema via Capacitor; registro de auditoria da cópia.",
            "Must",
            "3"
        ],
        [
            "US06",
            "Rede & VPN WireGuard",
            "Como trabalhador em regime remoto/viagem, quero me conectar a um túnel VPN seguro em redes Wi-Fi públicas, para que meu tráfego não seja interceptado.",
            "Túnel WireGuard nativo Curve25519 via porta UDP 51820; servidor Linux Ubuntu dedicado; verificação em tempo real de mascaramento de IP e anti-vazamento DNS.",
            "Must",
            "13"
        ],
        [
            "US07",
            "Rede & VPN WireGuard",
            "Como usuário Pro/Ultra, quero contar com alternativa de conexão rápida Cloudflare WARP WireGuard, para otimizar velocidade de navegação.",
            "Provisionamento dinâmico de chaves WARP via API segura; ping e latência exibidos no painel; failover suave em caso de indisponibilidade.",
            "Should",
            "8"
        ],
        [
            "US08",
            "Defesa contra Phishing",
            "Como colaborador, quero colar ou compartilhar links suspeitos em um detector heurístico, para saber imediatamente se a página é segura antes de acessá-la.",
            "Motor heurístico em tempo real; verificação de HTTPS, @ spoofing, IP direto, encurtadores e TLDs suspeitos; cálculo de Threat Score (0 a 100).",
            "Must",
            "8"
        ],
        [
            "US09",
            "Auditoria de Ameaças",
            "Como profissional, quero verificar se meu e-mail ou senhas já constam em grandes vazamentos globais, para atualizar credenciais comprometidas.",
            "Consulta k-Anonymity HIBP com prefixo SHA-1 de 5 caracteres; a senha em texto claro jamais transita na rede; auditoria de e-mails em dumps conhecidos.",
            "Must",
            "5"
        ],
        [
            "US10",
            "Hardening & Privacidade",
            "Como empresa consciente de riscos, quero impedir que o app sofra capturas de tela ou gravações maliciosas em segundo plano no celular.",
            "Habilitação nativa de FLAG_SECURE no Android (Privacy Screen); tela preta na lista de apps recentes; bloqueio CSS complementar na versão Web.",
            "Must",
            "5"
        ],
        [
            "US11",
            "Educação & Bem-Estar",
            "Como colaborador, quero acessar pílulas educativas interativas e um quiz de segurança, para aprimorar meus conhecimentos sem sofrer estresse de treinamento.",
            "13 tópicos divididos em Ataques Comuns, Como Evitar e Boas Práticas; Quiz dinâmico com feedback e explicações imediatas; linguagem inclusiva.",
            "Must",
            "5"
        ],
        [
            "US12",
            "Extensão de Navegador",
            "Como usuário corporativo em desktop, quero uma extensão Chrome Manifest V3 que preencha logins e detecte phishing nas abas ativas sem complicação.",
            "Service worker background.js seguro; content-script.js isolado; preenchimento com um clique; bridge com túnel VPN e geolocalização protegida.",
            "Should",
            "8"
        ],
        [
            "US13",
            "Compliance & LGPD",
            "Como auditor ou encarregado de dados (DPO), quero exportar os registros de auditoria e segurança em CSV, para comprovar conformidade legal.",
            "Logs imutáveis de ações críticas; exportação compatível com Excel/Planilhas; registros de login, tentativas com falha, rotação de chaves e bloqueios.",
            "Must",
            "5"
        ],
        [
            "US14",
            "Monetização SaaS",
            "Como gestor de TI, quero contratar e gerenciar planos Free, Pro e Ultra/Enterprise com limites bem definidos, para atender toda a minha equipe.",
            "Gating de funcionalidades por nível de plano; checkout e ciclo de cobrança mensal/anual; suporte a controle de múltiplos nós VPN e cofre em nuvem.",
            "Should",
            "5"
        ],
    ]
    add_table_data(doc, backlog_headers, backlog_rows, [1.5, 2.5, 4.0, 4.0, 1.8, 1.2])
    
    add_heading_2(doc, "3.6 Cronograma Inicial de Sprints e Entregas")
    add_body_p(
        doc,
        "O cronograma de desenvolvimento foi estruturado ao longo de seis Sprints quinzenais de trabalho intensivo, "
        "totalizando doze semanas de engenharia, conforme detalhado na Tabela 2:"
    )
    
    # TABELA 2: CRONOGRAMA
    cron_headers = ["Sprint", "Duração", "Período", "Escopo e Entregáveis Principais", "Responsáveis", "Status"]
    cron_rows = [
        [
            "Sprint 1",
            "2 semanas",
            "Semana 01 - 02",
            "Levantamento de requisitos, desenho da arquitetura Zero-Knowledge, setup do repositório GitHub e prototipação UI/UX no Figma.",
            "Miguel, Nikolas, Felipe",
            "Concluído"
        ],
        [
            "Sprint 2",
            "2 semanas",
            "Semana 03 - 04",
            "Implementação do núcleo criptográfico Web Crypto (AES-GCM, PBKDF2), estrutura do cofre de credenciais e autenticação biométrica/PIN.",
            "Miguel (Cripto), Nikolas (UI)",
            "Concluído"
        ],
        [
            "Sprint 3",
            "2 semanas",
            "Semana 05 - 06",
            "Provisionamento da VPS Linux, configuração do WireGuard VPN (servidor/cliente), rotação de chaves Curve25519 e módulo Cloudflare WARP.",
            "Miguel (VPN/Redes), Felipe (Logs)",
            "Concluído"
        ],
        [
            "Sprint 4",
            "2 semanas",
            "Semana 07 - 08",
            "Desenvolvimento do motor de detecção de links suspeitos (Anti-Phishing), auditoria k-Anonymity HIBP e hardening (Privacy Screen/Clipboard).",
            "Felipe (Hardening/Auditoria), Nikolas (UI)",
            "Concluído"
        ],
        [
            "Sprint 5",
            "2 semanas",
            "Semana 09 - 10",
            "Criação da Central de Educação Digital (13 tópicos), Quiz interativo, Extensão Chrome Manifest V3 e sistema de planos e assinaturas SaaS.",
            "Nikolas (Extension/Edu), Miguel (Planos)",
            "Concluído"
        ],
        [
            "Sprint 6",
            "2 semanas",
            "Semana 11 - 12",
            "Bateria de testes automatizados unitários (Vitest) e ponta a ponta (Cypress), auditoria de segurança, consolidação da monografia ABNT.",
            "Felipe (QA/ABNT), Miguel, Nikolas",
            "Concluído"
        ],
    ]
    add_table_data(doc, cron_headers, cron_rows, [1.8, 1.8, 2.2, 5.0, 2.7, 1.5])

    # =========================================================================
    # CAPÍTULO 4: DOCUMENTO DE REQUISITOS DO SISTEMA
    # =========================================================================
    print("[PARTE 2] Injetando Capítulo 4: Documento de Requisitos do Sistema (RFs e RNFs)...")
    doc.add_page_break()
    
    add_heading_1(doc, "4. DOCUMENTO DE REQUISITOS DO SISTEMA")
    
    add_heading_2(doc, "4.1 Diretrizes e Padrões de Engenharia de Requisitos")
    add_body_p(
        doc,
        "A especificação formal de requisitos constitui um dos pilares mais críticos da Engenharia de Software, "
        "assegurando que as necessidades dos usuários e as salvaguardas de cibersegurança sejam traduzidas com exatidão "
        "em funcionalidades verificáveis, testáveis e rastreáveis. Conforme orienta Sommerville (2019), os requisitos dividem-se "
        "fundamentalmente em Requisitos Funcionais (o que o sistema deve fazer) e Requisitos Não Funcionais (como o sistema "
        "deve se comportar sob restrições de segurança, desempenho, usabilidade, ergonomia cognitiva e portabilidade)."
    )
    
    add_heading_2(doc, "4.2 Especificação Exaustiva de Requisitos Funcionais (RF)")
    add_body_p(
        doc,
        "A Tabela 3 consolida o catálogo exaustivo de 25 Requisitos Funcionais (RF01 a RF25), extraídos diretamente da arquitetura "
        "e do código-fonte real do ecossistema SeguranApp (RiskZero):"
    )
    
    # TABELA 3: REQUISITOS FUNCIONAIS
    rf_headers = ["ID", "Nome do Requisito", "Descrição Detalhada da Funcionalidade", "Regra de Negócio / Validação Técnica", "Prioridade"]
    rf_rows = [
        [
            "RF01",
            "Criação de Conta e Chave Mestra",
            "O sistema deve permitir que o usuário crie uma conta local ou sincronizada, gerando uma Senha Mestra fortalecida.",
            "A chave de criptografia deve ser derivada exclusivamente no dispositivo cliente via PBKDF2 (600k iterações) e salt de 16 bytes. A senha mestra nunca trafega em texto claro.",
            "Alta"
        ],
        [
            "RF02",
            "Autenticação Biométrica e Desbloqueio",
            "O aplicativo deve permitir desbloqueio ágil da sessão por biometria (impressão digital ou FaceID) ou PIN de 6 dígitos.",
            "A liberação biométrica acessa uma chave criptográfica encapsulada no hardware seguro (Android Keystore / WebAuthn). Três falhas consecutivas exigem reentrada da senha mestra.",
            "Alta"
        ],
        [
            "RF03",
            "Autenticador 2FA/TOTP Integrado",
            "O sistema deve gerar códigos de segundo fator temporários de 6 dígitos integrados ao cofre de credenciais.",
            "Conformidade rigorosa com a RFC 6238 (HMAC-SHA1), calculando tokens a cada 30 segundos a partir de chave Base32 privada cifrada no cofre.",
            "Alta"
        ],
        [
            "RF04",
            "Cadastro e Cifragem de Credenciais",
            "O usuário deve cadastrar novas contas, especificando título, usuário, senha, URL e categoria (Login, Cartão, Nota, Identidade).",
            "Cada registro deve ser cifrado individualmente com AES-GCM 256 bits, utilizando um IV aleatório de 96 bits exclusivo gerado por CSPRNG.",
            "Alta"
        ],
        [
            "RF05",
            "Cifragem de Notas e Segredos",
            "O sistema deve possibilitar a inclusão de campos de notas confidenciais e tokens de API em qualquer item do cofre.",
            "Campos de notas adicionais devem ser armazenados em objetos criptográficos separados dentro do envelope do item.",
            "Média"
        ],
        [
            "RF06",
            "Decifração Sob Demanda na Memória",
            "O aplicativo deve exibir senhas e dados confidenciais apenas quando requisitado expressamente pelo usuário.",
            "A decifração ocorre exclusivamente na memória volátil de trabalho (RAM). Ao trocar de aba ou tela, as variáveis em texto claro são destruídas (zeroização).",
            "Alta"
        ],
        [
            "RF07",
            "Histórico de Senhas e Auditoria",
            "O sistema deve registrar o histórico de senhas anteriores utilizadas em cada credencial cadastrada.",
            "Históricos são salvos criptografados juntamente com o registro, permitindo rastrear quando e quantas vezes uma senha foi modificada.",
            "Média"
        ],
        [
            "RF08",
            "Cópia com Limpeza do Clipboard",
            "O aplicativo deve copiar senhas e códigos TOTP com um clique, disparando temporizador regressivo de 30 segundos.",
            "Após 30 segundos, a área de transferência do sistema operacional deve ser compulsoriamente limpa via plugin nativo para evitar leitura por outros aplicativos.",
            "Alta"
        ],
        [
            "RF09",
            "Importação e Exportação de Cofres",
            "O sistema deve permitir importar credenciais de arquivos CSV (Bitwarden, 1Password, Chrome) e exportar backup encriptado.",
            "Arquivos de backup exportados devem ser cifrados com a própria chave mestra derivada, gerando payload protegido por senha.",
            "Média"
        ],
        [
            "RF10",
            "Cifragem por Envelope e Rotação",
            "O sistema deve estruturar os dados do cofre através de Cifragem por Envelope (DEK cifrada pela KEK).",
            "A alteração da senha mestra deve apenas re-cifrar a DEK de 256 bits, sem demandar a re-encriptação de centenas de itens individuais.",
            "Alta"
        ],
        [
            "RF11",
            "Conexão VPN WireGuard em Alta Velocidade",
            "O aplicativo deve fornecer conexão a túneis VPN seguros operando sob o protocolo WireGuard nativo.",
            "Estabelece túnel na porta UDP 51820 direcionado a VPS Linux dedicada (Ubuntu 22.04 LTS), encapsulando todo o tráfego do dispositivo móvel.",
            "Alta"
        ],
        [
            "RF12",
            "Geração Local de Chaves Curve25519",
            "O aplicativo móvel deve gerar pares de chaves assimétricas em curva elíptica Curve25519 de forma isolada.",
            "A chave privada do cliente permanece protegida no aparelho; somente a chave pública é registrada no peer do servidor WireGuard.",
            "Alta"
        ],
        [
            "RF13",
            "Mascaramento de IP e Anti-Vazamento DNS",
            "O sistema deve verificar continuamente se o endereço IP público foi mascarado com sucesso para o IP da VPS e aplicar DNS seguro.",
            "Roteamento de DNS forçado para provedores confiáveis (Cloudflare 1.1.1.1 ou Quad9), alertando o usuário caso ocorra falha de handshake.",
            "Alta"
        ],
        [
            "RF14",
            "Integração Cloudflare WARP",
            "O sistema deve suportar servidores de túnel rápido através da infraestrutura de borda Cloudflare WARP.",
            "Registro automatizado de perfil WireGuard com chaves Curve25519 e provisionamento de rotas de alta capacidade.",
            "Média"
        ],
        [
            "RF15",
            "Detecção Heurística Anti-Phishing",
            "O aplicativo deve analisar URLs inseridas e avaliar indicadores técnicos de golpe ou engenharia social.",
            "Checagem de ausência de HTTPS, disfarce com '@', uso de endereço IP numérico direto, serviços de encurtamento e TLDs de alto risco (.xyz, .click, .tk).",
            "Alta"
        ],
        [
            "RF16",
            "Cálculo Dinâmico de Threat Score",
            "O sistema deve calcular uma pontuação de risco de 0 a 100 pontos e emitir um veredito claro (Seguro, Suspeito ou Perigoso).",
            "Cada teste heurístico reprovado penaliza a nota. Domínios que falsificam bancos (Itaú, Bradesco, Nubank) ou portais governamentais são classificados como Perigosos.",
            "Alta"
        ],
        [
            "RF17",
            "Histórico de Links com Veredito",
            "O sistema deve manter histórico local de links consultados com seus respectivos relatórios e carimbos de data/hora.",
            "Permite reexaminar relatórios anteriores e limpar o histórico de buscas sob demanda do usuário.",
            "Baixa"
        ],
        [
            "RF18",
            "Auditoria de Vazamentos de E-mail",
            "O sistema deve permitir consultar se um e-mail corporativo ou pessoal foi exposto em grandes incidentes de segurança.",
            "Consulta bancos de dados de vazamentos públicos reconhecidos, apresentando as datas, empresas violadas e categorias de dados expostos.",
            "Alta"
        ],
        [
            "RF19",
            "Checagem de Senhas por k-Anonymity",
            "O usuário deve poder testar a robustez de uma senha contra listas de vazamentos mundiais sem que a senha seja divulgada.",
            "Utiliza o modelo k-Anonymity com prefixo SHA-1 de 5 caracteres via API HaveIBeenPwned. Apenas os 5 primeiros caracteres do hash são transmitidos.",
            "Alta"
        ],
        [
            "RF20",
            "Bloqueio de Captura de Tela (Privacy Screen)",
            "O aplicativo móvel deve impedir que capturas de tela ou gravações sejam realizadas dentro do app.",
            "Ativação nativa da flag FLAG_SECURE na janela do Android via Capacitor, protegendo senhas e dados confidenciais contra malwares espiões.",
            "Alta"
        ],
        [
            "RF21",
            "Modo de Camuflagem de Interface",
            "O sistema deve disponibilizar opção de camuflagem visual para disfarçar o propósito do aplicativo em situações de risco.",
            "Altera dinamicamente o tema e elementos visuais da interface, reduzindo a exposição em ambientes públicos hostis.",
            "Baixa"
        ],
        [
            "RF22",
            "Trilha de Auditoria e Exportação LGPD",
            "O sistema deve registrar eventos críticos de segurança em trilha de auditoria e permitir sua exportação em formato CSV.",
            "Registra logins, tentativas falhas, bloqueios por PIN, rotação de chaves e detecções de root, em total conformidade com o princípio de prestação de contas da LGPD.",
            "Alta"
        ],
        [
            "RF23",
            "Central de Aprendizado em Segurança",
            "O sistema deve disponibilizar 13 tópicos educativos estruturados em Ataques Comuns, Como Evitar e Boas Práticas.",
            "Textos explicativos curtos com ícones ilustrativos, conceitos de funcionamento prático e linguagem acessível a colaboradores não técnicos.",
            "Alta"
        ],
        [
            "RF24",
            "Quiz Gamificado de Conscientização",
            "O aplicativo deve incluir um quiz dinâmico com perguntas sobre senhas, phishing, HTTPS e direitos garantidos pela LGPD.",
            "Cálculo automático de pontuação, barra de progresso visual, medalhas de desempenho e explicações didáticas para cada alternativa correta ou incorreta.",
            "Média"
        ],
        [
            "RF25",
            "Gestão de Planos de Assinatura SaaS",
            "O sistema deve controlar os níveis de acesso (Free, Pro e Ultra/Enterprise) com limitação dinâmica de recursos.",
            "Plano Free restrito a recursos locais; Pro inclui cofre em nuvem e auditoria ilimitada; Ultra inclui túnel WireGuard de alta performance e auditoria corporativa.",
            "Média"
        ],
    ]
    add_table_data(doc, rf_headers, rf_rows, [1.5, 3.2, 5.0, 4.3, 1.5])
    
    add_heading_2(doc, "4.3 Especificação Exaustiva de Requisitos Não Funcionais (RNF)")
    add_body_p(
        doc,
        "A Tabela 4 apresenta os 15 Requisitos Não Funcionais (RNF01 a RNF15) rigorosamente estabelecidos para a solução, "
        "com especial ênfase em garantias criptográficas, desempenho, ergonomia cognitiva voltada ao bem-estar e conformidade legal:"
    )
    
    # TABELA 4: REQUISITOS NÃO FUNCIONAIS
    rnf_headers = ["ID", "Categoria", "Requisito Não Funcional", "Critério de Medição e Aceite Técnico", "Módulo"]
    rnf_rows = [
        [
            "RNF01",
            "Segurança Criptográfica",
            "Uso mandatório de criptografia simétrica de bloco autenticado com padrão militar AES-GCM de 256 bits.",
            "Garantia de integridade com tag GMAC de 128 bits e IV aleatório exclusivo de 96 bits via Web Crypto API nativa do navegador/WebView.",
            "Cofre / Núcleo"
        ],
        [
            "RNF02",
            "Segurança Criptográfica",
            "Derivação de chaves a partir de senha mestra com resistência comprovada a força bruta.",
            "Aplicação de PBKDF2 com HMAC-SHA256 e no mínimo 600.000 iterações (recomendação OWASP 2023) e arquitetura compatível com Argon2id.",
            "Autenticação"
        ],
        [
            "RNF03",
            "Segurança de Dados",
            "Arquitetura estrita de Conhecimento Zero (Zero-Knowledge Architecture).",
            "O servidor backend (Firebase Firestore) armazena exclusivamente envelopes com 'ciphertext', 'iv' e 'salt'. O provedor de nuvem jamais tem acesso às chaves ou aos dados decifrados.",
            "Backend / Nuvem"
        ],
        [
            "RNF04",
            "Segurança de Sessão",
            "Zeroização de memória volátil e auto-bloqueio por inatividade.",
            "Após período pré-determinado de inatividade (ex: 5 minutos) ou minimização do aplicativo, a sessão é destruída e o overlay de bloqueio (LockOverlay) é ativado imediatamente.",
            "Sessão / Mobile"
        ],
        [
            "RNF05",
            "Segurança de Rede",
            "Túnel VPN baseado em criptografia assimétrica de curva elíptica de última geração.",
            "Utilização do protocolo WireGuard operando com chaves Curve25519 (256 bits), cifra simétrica ChaCha20 e autenticação Poly1305 sobre protocolo UDP.",
            "Rede / VPN"
        ],
        [
            "RNF06",
            "Desempenho",
            "Tempo de decifração e apresentação do cofre na tela do dispositivo inferior a 100 milissegundos.",
            "O processamento criptográfico deve ocorrer de forma assíncrona sem travar a thread de renderização da interface (60 FPS contínuos).",
            "Frontend / UI"
        ],
        [
            "RNF07",
            "Desempenho",
            "Tempo de estabelecimento de conexão e aperto de mão (Handshake) da VPN inferior a 500 milissegundos.",
            "Negociação criptográfica direta em UDP através de sockets de rede otimizados sem múltiplos passos de ida e volta (zero-RTT).",
            "VPN / Redes"
        ],
        [
            "RNF08",
            "Usabilidade & Bem-Estar",
            "Design ergonômico com redução comprovada de estresse visual e cognitivo.",
            "Interface construída em Dark Mode suave (paleta Slate e HSL), tipografia moderna (Inter/Roboto) com espaçamento generoso e ausência de elementos visuais agressivos.",
            "Interface UI/UX"
        ],
        [
            "RNF09",
            "Usabilidade & Bem-Estar",
            "Mitigação da Fadiga de Alertas (Alert Fatigue Mitigation).",
            "Alertas de segurança classificados por níveis de gravidade com mensagens construtivas e orientadoras, eliminando pop-ups intrusivos desnecessários.",
            "Notificações"
        ],
        [
            "RNF10",
            "Ergonomia Cognitiva",
            "Preenchimento automático e cópia de credenciais com esforço cognitivo mínimo.",
            "Redução do número de cliques para recuperação e uso de senhas corporativas (máximo de 2 toques no celular ou 1 clique na extensão).",
            "Extensão / Mobile"
        ],
        [
            "RNF11",
            "Portabilidade",
            "Compatibilidade nativa em sistemas operacionais móveis e ambientes de desktop.",
            "Execução em dispositivos Android (versão 8.0 Oreo até Android 14+), navegadores modernos (Chrome, Firefox, Edge, Safari) e extensão Chrome MV3.",
            "Plataforma"
        ],
        [
            "RNF12",
            "Segurança no Backend",
            "Isolamento multilocatário absoluto no banco de dados em nuvem.",
            "Regras de segurança no Firestore garantindo que apenas usuários autenticados possam ler ou escrever documentos do seu próprio UID (`request.auth.uid == userId`).",
            "Firestore Cloud"
        ],
        [
            "RNF13",
            "Confiabilidade",
            "Capacidade de operação plena em modo offline.",
            "O cofre e os módulos educativos devem ser acessíveis localmente mesmo sem conexão à internet através de cache criptografado seguro (Capacitor Preferences).",
            "Armazenamento"
        ],
        [
            "RNF14",
            "Eficiência Energética",
            "Baixo consumo de bateria e processamento em segundo plano no smartphone.",
            "O cliente VPN e os serviços em background não devem consumir mais de 3% da bateria por hora de utilização contínua.",
            "Android Core"
        ],
        [
            "RNF15",
            "Conformidade Legal",
            "Aderência integral aos princípios e exigências da Lei Geral de Proteção de Dados (LGPD).",
            "Coleta mínima de dados (Princípio da Necessidade), ausência de custódia de senhas desprotegidas e capacidade de exportação e exclusão total de dados sob solicitação.",
            "Compliance LGPD"
        ],
    ]
    add_table_data(doc, rnf_headers, rnf_rows, [1.5, 2.5, 4.5, 4.5, 1.8])

    # Salvar o documento atualizado
    doc.save(target_path)
    try:
        doc.save(workspace_target)
    except Exception as e:
        print(f"Aviso ao salvar na raiz do workspace: {e}")
        
    print(f"[PARTE 2 CONCLUÍDA COM SUCESSO!]")
    print(f"Arquivo gerado: {target_path}")
    print(f"Total de parágrafos no documento após Parte 2: {len(doc.paragraphs)}")
    print(f"Total de tabelas no documento após Parte 2: {len(doc.tables)}")

if __name__ == "__main__":
    run_part2()
