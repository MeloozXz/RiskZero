import os
import sys
from docx import Document

def inspect():
    candidate_paths = [
        os.path.join(os.path.dirname(__file__), "..", "TCC CERTO.docx"),
        os.path.join(os.path.dirname(__file__), "..", "seguran-aapp-main", "seguran-aapp-main", "TCC CERTO.docx"),
        os.path.join(os.getcwd(), "TCC CERTO.docx"),
        os.path.join(os.getcwd(), "seguran-aapp-main", "seguran-aapp-main", "TCC CERTO.docx"),
    ]
    
    doc_path = None
    for p in candidate_paths:
        if os.path.exists(p):
            doc_path = os.path.abspath(p)
            break
            
    if not doc_path:
        print("ERRO: Não foi possível encontrar TCC CERTO.docx")
        sys.exit(1)
        
    print(f"Lendo documento: {doc_path}")
    doc = Document(doc_path)
    
    output_lines = []
    output_lines.append(f"INSPEÇÃO DO ARQUIVO DOCX: {doc_path}")
    output_lines.append("=" * 80)
    
    # 1. Seções e Margens
    output_lines.append("\n--- SEÇÕES E CONFIGURAÇÃO DE PÁGINA ---")
    for idx, s in enumerate(doc.sections):
        output_lines.append(
            f"Seção {idx}: "
            f"Orientação={s.orientation}, "
            f"Largura={s.page_width.cm:.2f}cm, "
            f"Altura={s.page_height.cm:.2f}cm, "
            f"Margem Esquerda={s.left_margin.cm:.2f}cm, "
            f"Margem Direita={s.right_margin.cm:.2f}cm, "
            f"Margem Superior={s.top_margin.cm:.2f}cm, "
            f"Margem Inferior={s.bottom_margin.cm:.2f}cm"
        )
        
    # 2. Estilos disponíveis
    output_lines.append("\n--- ESTILOS DISPONÍVEIS NO DOCUMENTO ---")
    styles_used = set()
    for p in doc.paragraphs:
        if p.style:
            styles_used.add(p.style.name)
    output_lines.append(f"Estilos em uso: {', '.join(sorted(styles_used))}")

    # 3. Parágrafos
    output_lines.append("\n--- PARÁGRAFOS DO DOCUMENTO ---")
    output_lines.append(f"Total de parágrafos: {len(doc.paragraphs)}")
    for i, p in enumerate(doc.paragraphs):
        text = p.text.strip()
        style_name = p.style.name if p.style else "N/A"
        # Always output non-empty or heading or first 30 paragraphs
        if text or i < 30:
            preview = text.replace("\n", " ")
            output_lines.append(f"[{i:04d}] [Estilo: {style_name:<20}] {preview}")

    # 4. Tabelas
    output_lines.append("\n--- TABELAS DO DOCUMENTO ---")
    output_lines.append(f"Total de tabelas: {len(doc.tables)}")
    for t_idx, table in enumerate(doc.tables):
        rows = len(table.rows)
        cols = len(table.columns) if rows > 0 else 0
        output_lines.append(f"\nTabela {t_idx}: {rows} linhas x {cols} colunas")
        for r_idx, row in enumerate(table.rows):
            row_cells = [cell.text.strip().replace("\n", " ") for cell in row.cells]
            output_lines.append(f"  Linha {r_idx:02d}: {' | '.join(row_cells)}")

    output_content = "\n".join(output_lines)
    
    # Salvar em scripts/estrutura_atual.txt
    out_dir = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.join(out_dir, "estrutura_atual.txt")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(output_content)
        
    # Copiar também para a raiz do workspace scripts se diferente
    workspace_scripts_out = os.path.join("C:\\Users\\Aluno\\Downloads\\seguran-aapp-main (2)", "scripts", "estrutura_atual.txt")
    if os.path.abspath(out_path) != os.path.abspath(workspace_scripts_out):
        try:
            with open(workspace_scripts_out, "w", encoding="utf-8") as f:
                f.write(output_content)
        except Exception:
            pass

    print(f"Estrutura gravada com sucesso em: {out_path}")
    print(f"Total de parágrafos analisados: {len(doc.paragraphs)}")
    print(f"Total de tabelas analisadas: {len(doc.tables)}")

if __name__ == "__main__":
    inspect()
