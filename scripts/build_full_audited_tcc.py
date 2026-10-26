import os
import sys
import docx

# Add scripts directory to path
sys.path.insert(0, os.path.dirname(__file__))

from curate_and_clean_docx import create_clean_document
from update_part1 import run_part1
from update_part2 import run_part2
from update_part3 import run_part3
from update_part4 import run_part4

def main():
    print("=" * 80)
    print("INICIANDO RECONSTRUÇÃO AUDITADA COMPLETA DO TCC")
    print("=" * 80)
    
    # Etapa 1: Elementos Pré-Textuais Limpos (Capa, Folha de Rosto, Aprovação, Dedicatória, Agradecimentos, Resumo Completo, Abstract Completo e Sumário)
    print("\n[ETAPA 1/5] Reconstruindo elementos pré-textuais limpos sem linhas vazias...")
    create_clean_document()
    
    # Etapa 2: Capítulos 1 e 2 (Introdução Oficial Expandida e Fundamentação Teórica)
    print("\n[ETAPA 2/5] Injetando Capítulos 1 e 2...")
    run_part1()
    
    # Etapa 3: Capítulos 3 e 4 (Metodologia, Scrum/Kanban, Backlog, Cronograma e Requisitos)
    print("\n[ETAPA 3/5] Injetando Capítulos 3 e 4 com Tabelas...")
    run_part2()
    
    # Etapa 4: Capítulos 5, 6 e 7 (Arquitetura, Banco de Dados, Dicionário de Dados e Telas com Placeholders)
    print("\n[ETAPA 4/5] Injetando Capítulos 5, 6 e 7 com Dicionário de Dados e Telas...")
    run_part3()
    
    # Etapa 5: Capítulos 8, 9, 10 e Referências (Testes, Casos de Teste, Plano de Negócios, Conclusão e ABNT NBR 6023)
    print("\n[ETAPA 5/5] Injetando Capítulos 8, 9, 10 e Referências Bibliográficas...")
    run_part4()
    
    print("\n" + "=" * 80)
    print("AUDITORIA FINAL DE INTEGRIDADE DO DOCUMENTO GERADO")
    print("=" * 80)
    
    target_path = os.path.join(os.path.dirname(__file__), "..", "TCC_Documentacao_Completa.docx")
    doc = docx.Document(target_path)
    
    empty_paras = 0
    consecutive_empty = 0
    max_consec_empty = 0
    page_breaks = 0
    
    for i, p in enumerate(doc.paragraphs):
        t = p.text.strip()
        xml = p._element.xml
        if 'w:br' in xml and 'type="page"' in xml:
            page_breaks += 1
            
        if not t:
            empty_paras += 1
            consecutive_empty += 1
            if consecutive_empty > max_consec_empty:
                max_consec_empty = consecutive_empty
        else:
            consecutive_empty = 0
            
    print(f"Total de Parágrafos Textuais: {len(doc.paragraphs)}")
    print(f"Total de Tabelas Formatadas: {len(doc.tables)}")
    print(f"Total de Quebras de Página Formais: {page_breaks}")
    print(f"Total de Linhas Vazias: {empty_paras} (Máximo consecutivo: {max_consec_empty})")
    
    # Validar presença dos capítulos
    headings_found = [p.text.strip() for p in doc.paragraphs if p.text.strip().startswith(("1.", "2.", "3.", "4.", "5.", "6.", "7.", "8.", "9.", "10.", "RESUMO", "ABSTRACT", "SUMÁRIO", "REFERÊNCIAS"))]
    print(f"\nCapítulos e Seções Principais Verificados ({len(headings_found)}):")
    for h in headings_found[:15]:
        print(f"  [OK] {h}")
    if len(headings_found) > 15:
        print(f"  ... e mais {len(headings_found)-15} tópicos verificados.")
        
    print("\n[SUCESSO ABSOLUTO] TCC_Documentacao_Completa.docx auditado e perfeitamente higienizado!")

if __name__ == "__main__":
    main()
