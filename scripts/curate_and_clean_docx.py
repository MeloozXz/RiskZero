import os
import sys
import docx
from docx.shared import Inches, Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx_helper import (
    get_base_doc_path, get_target_doc_path, get_workspace_target_doc_path,
    set_cell_background, set_cell_margins, set_table_borders,
    cant_split_row, repeat_header_row,
    add_heading_1, add_heading_2, add_heading_3,
    add_body_p, add_bullet_p, add_table_data
)

def create_clean_document():
    base_path = get_base_doc_path()
    target_path = get_target_doc_path()
    workspace_target = get_workspace_target_doc_path()
    
    print(f"=== AUDITORIA E REESTRUTURAÇÃO LIMPA DO TCC ===")
    print(f"Lendo modelo base original para herdar estilos e geometria: {base_path}")
    doc = docx.Document(base_path)
    
    # 1. Configurar seção única com margens ABNT originais
    section = doc.sections[0]
    section.top_margin = Cm(2.5)
    section.bottom_margin = Cm(2.5)
    section.left_margin = Cm(3.0)
    section.right_margin = Cm(3.0)
    section.page_width = Cm(21.0)
    section.page_height = Cm(29.7)
    
    # 2. Limpar TODOS os parágrafos antigos do documento
    # Isso elimina todas as 152 linhas em branco, repetições de nomes e páginas vazias
    for p in list(doc.paragraphs):
        p_elem = p._element
        p_elem.getparent().remove(p_elem)
        
    for t in list(doc.tables):
        t_elem = t._element
        t_elem.getparent().remove(t_elem)
        
    print("Documento limpo de todos os parágrafos fantasmas e repetições legadas.")
    
    # =========================================================================
    # ELEMENTO 1: CAPA (PÁGINA 1)
    # =========================================================================
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(2)
    r = p.add_run("SERVIÇO NACIONAL DE APRENDIZAGEM INDUSTRIAL — SENAI\nESCOLA SENAI OURINHOS\nCURSO TÉCNICO EM DESENVOLVIMENTO DE SISTEMAS")
    r.bold = True
    r.font.name = "Arial"
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(80)
    p.paragraph_format.space_after = Pt(0)
    r = p.add_run("MIGUEL RODRIGUES CAMARGO\nNIKOLAS MELO LIMA\nFELIPE MORINI")
    r.bold = True
    r.font.name = "Arial"
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(120)
    p.paragraph_format.space_after = Pt(0)
    r = p.add_run("BOAS PRÁTICAS DE SEGURANÇA DA INFORMAÇÃO, EDUCAÇÃO DIGITAL E BEM-ESTAR NO AMBIENTE CORPORATIVO: SISTEMA SEGURANAPP (RISKZERO)")
    r.bold = True
    r.font.name = "Arial"
    r.font.size = Pt(14)
    r.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(160)
    p.paragraph_format.space_after = Pt(0)
    r = p.add_run("OURINHOS / SP\n2026")
    r.bold = True
    r.font.name = "Arial"
    r.font.size = Pt(12)
    
    # =========================================================================
    # ELEMENTO 2: FOLHA DE ROSTO (PÁGINA 2)
    # =========================================================================
    doc.add_page_break()
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(20)
    p.paragraph_format.space_after = Pt(0)
    r = p.add_run("MIGUEL RODRIGUES CAMARGO\nNIKOLAS MELO LIMA\nFELIPE MORINI")
    r.bold = True
    r.font.name = "Arial"
    r.font.size = Pt(12)
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(100)
    p.paragraph_format.space_after = Pt(0)
    r = p.add_run("BOAS PRÁTICAS DE SEGURANÇA DA INFORMAÇÃO, EDUCAÇÃO DIGITAL E BEM-ESTAR NO AMBIENTE CORPORATIVO: SISTEMA SEGURANAPP (RISKZERO)")
    r.bold = True
    r.font.name = "Arial"
    r.font.size = Pt(13)
    
    # Natureza do trabalho (recuo de 8 cm à direita)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.left_indent = Cm(8.0)
    p.paragraph_format.space_before = Pt(60)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.0
    r = p.add_run(
        "Trabalho de Conclusão de Curso apresentado ao Serviço Nacional de Aprendizagem Industrial — Escola SENAI Ourinhos, "
        "como requisito parcial para obtenção do título de Técnico em Desenvolvimento de Sistemas.\n\n"
        "Área de Concentração: Cibersegurança, Engenharia de Software e Fator Humano.\n\n"
        "Orientador: Prof. João Paulo"
    )
    r.font.name = "Arial"
    r.font.size = Pt(10)
    r.font.color.rgb = RGBColor(0x33, 0x41, 0x55)
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(120)
    p.paragraph_format.space_after = Pt(0)
    r = p.add_run("OURINHOS / SP\n2026")
    r.bold = True
    r.font.name = "Arial"
    r.font.size = Pt(12)

    # =========================================================================
    # ELEMENTO 3: FOLHA DE APROVAÇÃO (PÁGINA 3)
    # =========================================================================
    doc.add_page_break()
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(0)
    r = p.add_run("MIGUEL RODRIGUES CAMARGO\nNIKOLAS MELO LIMA\nFELIPE MORINI")
    r.bold = True
    r.font.name = "Arial"
    r.font.size = Pt(12)
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(30)
    p.paragraph_format.space_after = Pt(0)
    r = p.add_run("BOAS PRÁTICAS DE SEGURANÇA DA INFORMAÇÃO, EDUCAÇÃO DIGITAL E BEM-ESTAR NO AMBIENTE CORPORATIVO: SISTEMA SEGURANAPP (RISKZERO)")
    r.bold = True
    r.font.name = "Arial"
    r.font.size = Pt(12)
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.left_indent = Cm(8.0)
    p.paragraph_format.space_before = Pt(30)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.0
    r = p.add_run(
        "Trabalho de Conclusão de Curso apresentado ao Serviço Nacional de Aprendizagem Industrial — Escola SENAI Ourinhos, "
        "como requisito parcial para obtenção do título de Técnico em Desenvolvimento de Sistemas."
    )
    r.font.name = "Arial"
    r.font.size = Pt(10)
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_before = Pt(30)
    p.paragraph_format.space_after = Pt(15)
    r = p.add_run("Aprovado em: _____ de ____________________ de 2026.")
    r.bold = True
    r.font.name = "Arial"
    r.font.size = Pt(11)
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(20)
    p.paragraph_format.space_after = Pt(25)
    r = p.add_run("BANCA EXAMINADORA")
    r.bold = True
    r.font.name = "Arial"
    r.font.size = Pt(12)
    
    bancas = [
        ("Prof. João Paulo (Orientador)", "Escola SENAI Ourinhos"),
        ("Prof. Convidado 1", "Escola SENAI Ourinhos"),
        ("Prof. Convidado 2", "Escola SENAI Ourinhos"),
    ]
    for nome, inst in bancas:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(18)
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.0
        r_line = p.add_run("_____________________________________________________\n")
        r_line.font.name = "Arial"
        r_name = p.add_run(f"{nome}\n{inst}")
        r_name.font.name = "Arial"
        r_name.font.size = Pt(10)

    # =========================================================================
    # ELEMENTO 4: DEDICATÓRIA E AGRADECIMENTOS (PÁGINA 4)
    # =========================================================================
    doc.add_page_break()
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_before = Pt(20)
    p.paragraph_format.space_after = Pt(12)
    r = p.add_run("DEDICATÓRIA")
    r.bold = True
    r.font.name = "Arial"
    r.font.size = Pt(12)
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.left_indent = Cm(6.0)
    p.paragraph_format.line_spacing = 1.5
    p.paragraph_format.space_after = Pt(40)
    r = p.add_run(
        "Dedicamos este trabalho a todas as pessoas que estiveram ao nosso lado ao longo dessa caminhada, "
        "oferecendo incentivo constante, apoio e motivação para que pudéssemos superar os desafios técnicos e "
        "alcançar mais essa conquista em nossas vidas acadêmicas e profissionais. "
        "Aos nossos familiares e amigos leais, que nos sustentaram com afeto e paciência durante as longas jornadas de estudo."
    )
    r.font.name = "Arial"
    r.font.size = Pt(11)
    r.font.italic = True
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_before = Pt(20)
    p.paragraph_format.space_after = Pt(12)
    r = p.add_run("AGRADECIMENTOS")
    r.bold = True
    r.font.name = "Arial"
    r.font.size = Pt(12)
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.line_spacing = 1.5
    p.paragraph_format.first_line_indent = Cm(1.25)
    p.paragraph_format.space_after = Pt(10)
    r = p.add_run(
        "Aos nossos orientadores e docentes da Escola SENAI Ourinhos, expressamos nossa sincera e profunda gratidão "
        "pela dedicação exemplar, transmissão de conhecimentos sólidos e incentivo permanente que guiaram a construção deste projeto."
    )
    r.font.name = "Arial"
    r.font.size = Pt(11)
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.line_spacing = 1.5
    p.paragraph_format.first_line_indent = Cm(1.25)
    r = p.add_run(
        "Agradecemos de maneira especial ao Professor João Paulo, que nos inspirou a compreender a relevância estratégica "
        "deste tema, incentivando-nos a enxergar que a cibersegurança só é verdadeiramente eficaz quando compreende o fator "
        "humano e zela pelo bem-estar e saúde mental dos profissionais que operam a tecnologia diariamente."
    )
    r.font.name = "Arial"
    r.font.size = Pt(11)

    # =========================================================================
    # ELEMENTO 5: RESUMO (PÁGINA 5) - TEXTO COMPLETO PREENCHIDO
    # =========================================================================
    doc.add_page_break()
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(18)
    r = p.add_run("RESUMO")
    r.bold = True
    r.font.name = "Arial"
    r.font.size = Pt(12)
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.line_spacing = 1.0 # Espaçamento simples conforme ABNT NBR 6028
    p.paragraph_format.space_after = Pt(16)
    r = p.add_run(
        "O presente Trabalho de Conclusão de Curso aborda a intersecção indispensável entre as boas práticas de segurança "
        "da informação, a educação digital e o bem-estar no ambiente corporativo contemporâneo, culminando no desenvolvimento "
        "e validação da plataforma integrada de software SeguranApp (RiskZero). Com o avanço frenético da transformação digital, "
        "a adoção consolidada do regime de trabalho remoto e híbrido e o tráfego contínuo de dados estratégicos, as organizações "
        "encontram-se expostas a um cenário sem precedentes de ameaças cibernéticas, como vazamento de dados confidenciais, "
        "ataques de ransomware, fraudes financeiras e técnicas ardilosas de engenharia social. Constata-se que mais de 74% dos incidentes "
        "de segurança não decorrem exclusivamente de vulnerabilidades em códigos, mas do comportamento humano, potencializado "
        "pelo estresse tecnológico (technostress), sobrecarga cognitiva e fadiga de alertas (alert fatigue). Para responder a essa "
        "problemática, projetou-se um ecossistema integrado (aplicativo híbrido Android via Capacitor 6, interface web em React 19 "
        "e extensão Google Chrome Manifest V3) que alinha defesa ativa e usabilidade ergonômica. O sistema implementa um cofre de "
        "credenciais sob arquitetura de Conhecimento Zero (Zero-Knowledge) com cifragem autenticada AES-GCM de 256 bits, derivação KDF "
        "via PBKDF2 (600.000 iterações), autenticador 2FA/TOTP integrado (RFC 6238), cliente e servidor VPN WireGuard nativo em curva "
        "elíptica Curve25519 sobre VPS Linux dedicada, motor heurístico em tempo real para detecção de links maliciosos e phishing, "
        "auditoria de senhas via k-Anonymity (HIBP) e uma central de microaprendizagem gamificada com 13 tópicos ricos e quiz interativo. "
        "As salvaguardas nativas incluem bloqueio de capturas de tela (FLAG_SECURE via Privacy Screen), limpeza programada do clipboard "
        "em 30 segundos e geração de trilhas de auditoria exportáveis em CSV para conformidade rigorosa com a Lei Geral de Proteção de "
        "Dados (LGPD). Os testes automatizados (Vitest e Cypress) e o plano de negócios SaaS comprovaram 100% de conformidade técnica e "
        "alta viabilidade econômica, consolidando o SeguranApp como uma solução inovadora que harmoniza proteção de dados, mitigação do "
        "risco humano e produtividade saudável."
    )
    r.font.name = "Arial"
    r.font.size = Pt(11)
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.line_spacing = 1.0
    p.paragraph_format.space_before = Pt(8)
    r_title = p.add_run("Palavras-chave: ")
    r_title.bold = True
    r_title.font.name = "Arial"
    r_title.font.size = Pt(11)
    r_keys = p.add_run("Segurança da Informação. Fator Humano. Bem-Estar Digital. Criptografia Zero-Knowledge. WireGuard VPN. LGPD.")
    r_keys.font.name = "Arial"
    r_keys.font.size = Pt(11)

    # =========================================================================
    # ELEMENTO 6: ABSTRACT (PÁGINA 6) - TEXTO COMPLETO PREENCHIDO
    # =========================================================================
    doc.add_page_break()
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(18)
    r = p.add_run("ABSTRACT")
    r.bold = True
    r.font.name = "Arial"
    r.font.size = Pt(12)
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.line_spacing = 1.0
    p.paragraph_format.space_after = Pt(16)
    r = p.add_run(
        "This Undergraduate Thesis investigates the essential intersection between information security best practices, "
        "digital education, and occupational well-being in modern corporate environments, culminating in the design, development, "
        "and validation of the SeguranApp (RiskZero) software ecosystem. Accelerated digital transformation, combined with the widespread "
        "adoption of remote and hybrid work models, has expanded organizational attack surfaces, rendering companies highly vulnerable "
        "to cyber threats such as sensitive data breaches, ransomware infections, financial fraud, and sophisticated social engineering schemes. "
        "Empirical evidence reveals that over 74% of security breaches originate from human behavior, compounded by technological stress "
        "(technostress), cognitive overload, and alert fatigue. To mitigate these risks, an integrated multi-platform ecosystem was developed, "
        "comprising a hybrid Android application powered by Capacitor 6, a responsive React 19 web portal, and a Google Chrome Manifest V3 extension. "
        "The architecture adheres strictly to Zero-Knowledge principles, featuring an AES-GCM 256-bit authenticated credential vault, PBKDF2 "
        "key derivation (600,000 iterations), integrated RFC 6238 TOTP two-factor authentication, high-throughput WireGuard VPN tunneling "
        "utilizing Curve25519 elliptic curve cryptography on dedicated Linux VPS instances, a real-time heuristic anti-phishing engine with dynamic "
        "Threat Scoring, k-Anonymity password audit integration (HIBP), and a gamified microlearning module with 13 rich topics and interactive quizzes. "
        "Native device hardening features include screenshot prevention (FLAG_SECURE via Privacy Screen), automated 30-second clipboard clearing, "
        "and CSV audit trail export compliant with the Brazilian General Data Protection Law (LGPD). Automated testing suites (Vitest and Cypress) "
        "and SaaS economic modeling demonstrated 100% test success and robust market feasibility, establishing that cybersecurity achieves "
        "peak resilience when aligned with cognitive ergonomics and digital health."
    )
    r.font.name = "Arial"
    r.font.size = Pt(11)
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.line_spacing = 1.0
    p.paragraph_format.space_before = Pt(8)
    r_title = p.add_run("Keywords: ")
    r_title.bold = True
    r_title.font.name = "Arial"
    r_title.font.size = Pt(11)
    r_keys = p.add_run("Information Security. Human Factor. Digital Well-Being. Zero-Knowledge Cryptography. WireGuard VPN. LGPD.")
    r_keys.font.name = "Arial"
    r_keys.font.size = Pt(11)

    # =========================================================================
    # ELEMENTO 7: SUMÁRIO DINÂMICO E ESTRUTURADO (PÁGINA 7)
    # =========================================================================
    doc.add_page_break()
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(20)
    r = p.add_run("SUMÁRIO")
    r.bold = True
    r.font.name = "Arial"
    r.font.size = Pt(12)
    
    sumario_itens = [
        ("1. INTRODUÇÃO", "8"),
        ("  1.1 A Intersecção entre Cibersegurança e Bem-Estar Digital", "8"),
        ("  1.2 Justificativa e Impactos Organizacionais", "9"),
        ("  1.3 Problema de Pesquisa", "9"),
        ("  1.4 Objetivos da Pesquisa (Geral e Específicos)", "10"),
        ("  1.5 Estrutura da Monografia", "10"),
        ("2. FUNDAMENTAÇÃO TEÓRICA", "11"),
        ("  2.1 Os Pilares da Segurança da Informação (Tripé CID e Extensões)", "11"),
        ("  2.2 Engenharia Social, Vetores de Ataque e a Falha Humana", "12"),
        ("  2.3 Marco Regulatório: Lei Geral de Proteção de Dados (LGPD)", "13"),
        ("  2.4 Normas Internacionais: Família ABNT NBR ISO/IEC 27000", "14"),
        ("  2.5 Bem-Estar Digital, Ergonomia Cognitiva e Sobrecarga Tecnológica", "14"),
        ("  2.6 Arquitetura Criptográfica Contemporânea e Redes Seguras", "15"),
        ("3. METODOLOGIA E GESTÃO ÁGIL DO PROJETO", "17"),
        ("  3.1 Abordagem e Enquadramento Metodológico", "17"),
        ("  3.2 Framework Ágil Adotado: Integração Scrum e Kanban", "17"),
        ("  3.3 Estrutura, Papéis e Divisão de Responsabilidades da Equipe", "17"),
        ("  3.4 Gestão de Tarefas e Governança de Código no GitHub", "18"),
        ("  3.5 Product Backlog Completo (User Stories)", "18"),
        ("  3.6 Cronograma Inicial de Sprints e Entregas", "20"),
        ("4. DOCUMENTO DE REQUISITOS DO SISTEMA", "21"),
        ("  4.1 Diretrizes e Padrões de Engenharia de Requisitos", "21"),
        ("  4.2 Especificação Exaustiva de Requisitos Funcionais (RF01 a RF25)", "21"),
        ("  4.3 Especificação Exaustiva de Requisitos Não Funcionais (RNF01 a RNF15)", "24"),
        ("5. ARQUITETURA DO SISTEMA E STACK TECNOLÓGICA", "26"),
        ("  5.1 Padrão Arquitetural Adotado: Cliente-Servidor Zero-Knowledge", "26"),
        ("  5.2 Fluxo de Dados Ponta a Ponta (End-to-End Data Flow)", "27"),
        ("  5.3 Justificativa Técnica Minuciosa da Stack Tecnológica", "28"),
        ("6. MODELAGEM DE BANCO DE DADOS", "30"),
        ("  6.1 Abordagem e Estrutura Conceitual (MER) e Lógica (DER)", "30"),
        ("  6.2 Dicionário de Dados Exaustivo do Sistema (8 Entidades)", "30"),
        ("7. PROTOTIPAÇÃO E DESIGN DE INTERFACE (UI/UX E BEM-ESTAR)", "34"),
        ("  7.1 Princípios de UI/UX Voltados à Redução de Erros e Estresse", "34"),
        ("  7.2 Protótipo Navegável Figma e Especificação Tela a Tela (Placeholders)", "34"),
        ("8. ROTINAS E RELATÓRIO DE TESTES DE SOFTWARE", "37"),
        ("  8.1 Estratégia de Testes em Camadas e Matriz de Casos de Teste (CT01 a CT15)", "37"),
        ("  8.2 Relatório de Incidentes Encontrados e Ações Corretivas", "39"),
        ("9. PLANO DE NEGÓCIOS DO PROJETO (ESTUDO DE VIABILIDADE)", "41"),
        ("  9.1 Estudo de Viabilidade Mercadológica B2B e B2C", "41"),
        ("  9.2 Modelo de Precificação SaaS e Estratégia de Monetização", "41"),
        ("  9.3 Estimativa de Custos de Infraestrutura e Ponto de Equilíbrio (Break-Even)", "42"),
        ("  9.4 Curva de Vida do Produto e Roadmap de Upgrades Futuros", "43"),
        ("10. CONCLUSÃO E CONSIDERAÇÕES FINAIS", "44"),
        ("REFERÊNCIAS", "46"),
    ]
    
    for item, pag in sumario_itens:
        p_sum = doc.add_paragraph()
        p_sum.paragraph_format.line_spacing = 1.15
        p_sum.paragraph_format.space_before = Pt(1)
        p_sum.paragraph_format.space_after = Pt(2)
        is_main = not item.startswith("  ")
        r_item = p_sum.add_run(item.strip())
        r_item.bold = is_main
        r_item.font.name = "Arial"
        r_item.font.size = Pt(10 if not is_main else 10.5)
        
        # Pontilhado líder elegante
        pontos_count = max(5, 75 - len(item))
        r_dots = p_sum.add_run(" " + "." * pontos_count + " ")
        r_dots.font.name = "Arial"
        r_dots.font.size = Pt(9)
        r_dots.font.color.rgb = RGBColor(0x94, 0xA3, 0xB8)
        
        r_pag = p_sum.add_run(pag)
        r_pag.bold = is_main
        r_pag.font.name = "Arial"
        r_pag.font.size = Pt(10)

    print("Elementos pré-textuais e sumário perfeitamente reconstruídos.")
    
    # Salvar snapshot limpo
    doc.save(target_path)
    return doc

if __name__ == "__main__":
    create_clean_document()
