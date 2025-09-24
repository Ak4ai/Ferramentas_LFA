#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from PIL import Image, ImageTk
import os

from afd_generator import AFD

class AfdApp(tk.Tk):
    def __init__(self):
        super().__init__()

        self.title("Analisador de AFD")
        self.geometry("950x650")

        self.afd = None
        self.diagrama_path = None
        self.script_dir = os.path.dirname(os.path.abspath(__file__))

        # --- Layout ---
        main_frame = ttk.Frame(self, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        self.columnconfigure(0, weight=1)
        self.rowconfigure(0, weight=1)

        # --- Coluna Esquerda (Controles) ---
        left_frame = ttk.Frame(main_frame, padding="10")
        left_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), padx=(0, 10))
        main_frame.columnconfigure(0, weight=1)

        # --- Coluna Direita (Diagrama) ---
        right_frame = ttk.Frame(main_frame, padding="10")
        right_frame.grid(row=0, column=1, sticky=(tk.W, tk.E, tk.N, tk.S))
        main_frame.columnconfigure(1, weight=2)
        right_frame.rowconfigure(0, weight=1) # Allow diagram to expand vertically

        # --- Widgets de Controle (Coluna Esquerda) ---
        
        # 1. Seleção de Arquivo
        file_frame = ttk.LabelFrame(left_frame, text="1. Carregar AFD", padding="10")
        file_frame.grid(row=0, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        file_frame.columnconfigure(0, weight=1)

        self.btn_browse = ttk.Button(file_frame, text="Selecionar Arquivo...", command=self.abrir_dialogo_arquivo)
        self.btn_browse.grid(row=0, column=0, sticky=(tk.W, tk.E))

        self.lbl_file_path = ttk.Label(file_frame, text="Nenhum arquivo selecionado.", wraplength=350)
        self.lbl_file_path.grid(row=1, column=0, sticky=(tk.W, tk.E), pady=(5, 0))

        # Sugestões de arquivos
        sugestoes_frame = ttk.LabelFrame(left_frame, text="Sugestões de Arquivos (.txt)", padding="10")
        sugestoes_frame.grid(row=1, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        sugestoes_frame.columnconfigure(0, weight=1)
        self.popular_arquivos_sugeridos(sugestoes_frame)

        # 2. Gerar Palavras
        gen_frame = ttk.LabelFrame(left_frame, text="2. Gerar Palavras Aceitas", padding="10")
        gen_frame.grid(row=2, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        gen_frame.columnconfigure(1, weight=1)

        ttk.Label(gen_frame, text="Tam. Máximo:").grid(row=0, column=0, sticky=tk.W)
        self.tamanho_max_var = tk.StringVar(value="5")
        self.entry_tamanho = ttk.Entry(gen_frame, textvariable=self.tamanho_max_var, width=5)
        self.entry_tamanho.grid(row=0, column=1, sticky=tk.W, padx=(5, 10))

        self.btn_gerar = ttk.Button(gen_frame, text="Gerar", command=self.gerar_palavras, state=tk.DISABLED)
        self.btn_gerar.grid(row=0, column=2, sticky=tk.W)

        self.listbox_palavras = tk.Listbox(gen_frame, height=8)
        self.listbox_palavras.grid(row=1, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(5, 0))
        scrollbar = ttk.Scrollbar(gen_frame, orient=tk.VERTICAL, command=self.listbox_palavras.yview)
        self.listbox_palavras['yscrollcommand'] = scrollbar.set
        scrollbar.grid(row=1, column=3, sticky=(tk.N, tk.S))

        # 3. Testar Palavra
        test_frame = ttk.LabelFrame(left_frame, text="3. Testar Palavra Específica", padding="10")
        test_frame.grid(row=3, column=0, sticky=(tk.W, tk.E))
        test_frame.columnconfigure(0, weight=1)

        self.palavra_teste_var = tk.StringVar()
        self.entry_teste = ttk.Entry(test_frame, textvariable=self.palavra_teste_var, width=30)
        self.entry_teste.grid(row=0, column=0, sticky=(tk.W, tk.E), padx=(0, 10))

        self.btn_testar = ttk.Button(test_frame, text="Testar", command=self.testar_palavra, state=tk.DISABLED)
        self.btn_testar.grid(row=0, column=1, sticky=tk.W)

        self.lbl_resultado = ttk.Label(test_frame, text="", wraplength=350)
        self.lbl_resultado.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(5, 0))

        # --- Widgets do Diagrama (Coluna Direita) ---
        diag_frame = ttk.LabelFrame(right_frame, text="Diagrama do AFD", padding="10")
        diag_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        right_frame.rowconfigure(0, weight=1)
        right_frame.columnconfigure(0, weight=1)

        self.canvas_diag = tk.Canvas(diag_frame, bg="white")
        self.canvas_diag.pack(fill=tk.BOTH, expand=True)
        self.bind("<Configure>", self.redimensionar_diagrama)

    def popular_arquivos_sugeridos(self, parent_frame):
        try:
            # --- Scrollable Frame ---
            canvas = tk.Canvas(parent_frame, height=150)
            scrollbar = ttk.Scrollbar(parent_frame, orient="horizontal", command=canvas.xview)
            scrollable_frame = ttk.Frame(canvas)

            scrollable_frame.bind(
                "<Configure>",
                lambda e: canvas.configure(
                    scrollregion=canvas.bbox("all")
                )
            )

            canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
            canvas.configure(xscrollcommand=scrollbar.set)

            def _on_mouse_wheel(event):
                # Ajuste a sensibilidade da rolagem aqui (divida por um número maior para menos sensibilidade)
                canvas.xview_scroll(int(-1 * (event.delta / 120)), "units")

            canvas.bind_all("<MouseWheel>", _on_mouse_wheel)

            canvas.pack(side="top", fill="x", expand=True)
            scrollbar.pack(side="bottom", fill="x")

            # --- Populando os arquivos ---
            icones_dir = os.path.join(self.script_dir, "icones")
            os.makedirs(icones_dir, exist_ok=True)
            
            files = sorted([f for f in os.listdir(self.script_dir) if f.endswith('.txt')])
            
            for filename in files:
                thumbnail_path = os.path.join(icones_dir, f"{filename.replace('.txt', '')}.png")

                # Gerar diagrama e thumbnail se não existirem
                if not os.path.exists(thumbnail_path):
                    try:
                        afd_temp = AFD()
                        afd_temp.carregar_de_texto(os.path.join(self.script_dir, filename))
                        diagrama_path, _ = afd_temp.gerar_diagrama_com_thumbnail(
                            os.path.join(icones_dir, filename.replace('.txt', ''))
                        )
                        if diagrama_path:
                            thumbnail_path = diagrama_path
                    except Exception as e:
                        print(f"Erro ao gerar diagrama para {filename}: {e}")
                        thumbnail_path = None

                # Criar botão com imagem e texto
                try:
                    img = Image.open(thumbnail_path)
                    img = img.resize((100, 100), Image.Resampling.LANCZOS)
                    photo = ImageTk.PhotoImage(img)
                    
                    # Usar um Frame para agrupar botão e manter referência da imagem
                    btn_frame = ttk.Frame(scrollable_frame)
                    btn_frame.pack(side=tk.LEFT, padx=10, pady=5)

                    btn = ttk.Button(btn_frame, 
                                   image=photo, 
                                   text=filename, 
                                   compound=tk.TOP,
                                   command=lambda f=filename: self.carregar_arquivo(os.path.join(self.script_dir, f)))
                    btn.image = photo  # Manter referência
                    btn.pack()

                except Exception as e:
                    # Se falhar em carregar a imagem, criar um botão só com texto
                    btn = ttk.Button(scrollable_frame, 
                                   text=filename,
                                   command=lambda f=filename: self.carregar_arquivo(os.path.join(self.script_dir, f)))
                    btn.pack(side=tk.LEFT, padx=10, pady=5)
                    print(f"Erro ao carregar ou criar thumbnail para {filename}: {e}")

        except Exception as e:
            print(f"Erro ao buscar arquivos sugeridos: {e}")
            # Adicionar um label de erro no frame
            error_label = ttk.Label(parent_frame, text="Erro ao carregar sugestões.")
            error_label.pack()

    def abrir_dialogo_arquivo(self):
        filepath = filedialog.askopenfilename(
            title="Selecionar arquivo AFD",
            initialdir=self.script_dir,
            filetypes=(("Todos os arquivos", "*.*"), ("Arquivos de Texto", "*.txt"))
        )
        if filepath:
            self.carregar_arquivo(filepath)

    def carregar_arquivo(self, filepath):
        try:
            self.afd = AFD()
            self.afd.carregar_de_texto(filepath)
            self.lbl_file_path.config(text=os.path.basename(filepath))
            
            # Clear previous results
            self.listbox_palavras.delete(0, tk.END)
            self.lbl_resultado.config(text="")

            self.btn_gerar.config(state=tk.NORMAL)
            self.btn_testar.config(state=tk.NORMAL)
            
            # Gerar diagrama e atualizar thumbnail
            self.gerar_e_mostrar_diagrama()
            
            # Atualizar thumbnail para pré-visualização
            self.atualizar_thumbnail_arquivo(filepath)
            
            messagebox.showinfo("Sucesso", f"AFD '{os.path.basename(filepath)}' carregado com sucesso!")

        except Exception as e:
            messagebox.showerror("Erro ao Carregar", "Não foi possível carregar o arquivo:\n" + str(e))
            self.afd = None
            self.btn_gerar.config(state=tk.DISABLED)
            self.btn_testar.config(state=tk.DISABLED)
            self.canvas_diag.delete("all")
            self.lbl_file_path.config(text="Falha ao carregar arquivo.")


    def atualizar_thumbnail_arquivo(self, filepath):
        """Atualiza o thumbnail de pré-visualização para um arquivo específico."""
        try:
            icones_dir = os.path.join(self.script_dir, "icones")
            os.makedirs(icones_dir, exist_ok=True)
            
            filename = os.path.basename(filepath)
            nome_base = os.path.join(icones_dir, filename.replace('.txt', ''))
            
            # Gerar novo thumbnail
            _, thumbnail_path = self.afd.gerar_diagrama_com_thumbnail(nome_base)
            
            if thumbnail_path:
                print(f"Thumbnail atualizado para {filename}: {thumbnail_path}")
                
                # Forçar atualização da interface se necessário
                # (os thumbnails serão recarregados quando a interface for reconstruída)
                
        except Exception as e:
            print(f"Erro ao atualizar thumbnail para {filepath}: {e}")

    def gerar_e_mostrar_diagrama(self):
        if not self.afd:
            return
        try:
            self.diagrama_path = self.afd.gerar_diagrama_png()
            if self.diagrama_path and os.path.exists(self.diagrama_path):
                self.redimensionar_diagrama()
            else:
                self.canvas_diag.delete("all")
                self.canvas_diag.create_text(10, 10, anchor=tk.NW, text="Erro ao gerar o diagrama.")
        except Exception as e:
            messagebox.showerror("Erro no Diagrama", "Não foi possível gerar ou exibir o diagrama:\n" + str(e))

    def redimensionar_diagrama(self, event=None):
        if not self.diagrama_path or not os.path.exists(self.diagrama_path):
            return

        try:
            img = Image.open(self.diagrama_path)
            canvas_width = self.canvas_diag.winfo_width()
            canvas_height = self.canvas_diag.winfo_height()

            if canvas_width < 2 or canvas_height < 2: return

            img.thumbnail((canvas_width, canvas_height), Image.Resampling.LANCZOS)
            
            self.photo_img = ImageTk.PhotoImage(img)
            self.canvas_diag.delete("all")
            self.canvas_diag.create_image(canvas_width/2, canvas_height/2, anchor=tk.CENTER, image=self.photo_img)
        except Exception as e:
            print(f"Erro ao redimensionar diagrama: {e}")

    def gerar_palavras(self):
        if not self.afd:
            return
        
        try:
            tamanho = int(self.tamanho_max_var.get())
            if tamanho <= 0:
                messagebox.showwarning("Entrada Inválida", "O tamanho máximo deve ser maior que zero.")
                return

            palavras = self.afd.gerar_palavras(tamanho)
            self.listbox_palavras.delete(0, tk.END)
            
            if palavras:
                for palavra in palavras:
                    self.listbox_palavras.insert(tk.END, palavra)
            else:
                self.listbox_palavras.insert(tk.END, "Nenhuma palavra encontrada.")

        except ValueError:
            messagebox.showwarning("Entrada Inválida", "Por favor, insira um número válido para o tamanho.")
        except Exception as e:
            messagebox.showerror("Erro ao Gerar Palavras", "Ocorreu um erro:\n" + str(e))

    def testar_palavra(self):
        if not self.afd:
            return

        palavra = self.palavra_teste_var.get()
        if palavra.lower() in ['epsilon', 'ε']:
            palavra = ""

        aceita, caminho, msg = self.afd.processar_palavra_com_caminho(palavra)
        
        palavra_str = f"'{palavra}'" if palavra else "ε (vazia)"
        resultado_str = "ACEITA" if aceita else "REJEITADA"
        
        caminho_str = " → ".join(caminho)
        
        full_report = f"A palavra {palavra_str} é {resultado_str}.\nCaminho: {caminho_str}\n{msg}"
        
        self.lbl_resultado.config(text=full_report, foreground="green" if aceita else "red")

if __name__ == "__main__":
    app = AfdApp()
    app.mainloop()
