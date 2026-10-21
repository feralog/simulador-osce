# 🫀 Simulador Clínico OSCE - Emergência & Cardioversor Nihon Kohden TEC-5600

Simulador de alta fidelidade para estações práticas da OSCE de emergência médica. Reproduz com precisão o raciocínio clínico da abordagem inicial (**MOVE**, **ABCDE**, critérios de instabilidade), algoritmos de **PCR** (ritmos chocáveis e não chocáveis), **Protocolo OSASCO** para cardioversão elétrica e **Protocolo CAGADA** para assistolia.

Possui **Monitor Multiparamétrico em tempo real** e o console completo do desfibrilador/cardioversor/marca-passo **Nihon Kohden Cardiolife TEC-5600** com botões interativos e respostas fisiológicas dinâmicas.

**🔗 Acesse online:** https://feralog.github.io/simulador-osce/

---

## 🚀 Como Publicar no GitHub Pages (Passo a Passo)

O projeto já está **100% configurado** com:
- Caminhos relativos (`base: './'`) em `vite.config.ts`, permitindo funcionar em qualquer nome de repositório.
- Workflow automático de compilação e deploy em `.github/workflows/deploy.yml`.

### Opção 1: Automático via GitHub Actions (Recomendado - 2 minutos)

1. Crie um novo repositório no seu GitHub (ex: `simulador-osce`).
2. No seu computador, suba os arquivos do projeto para o GitHub:
   ```bash
   git init
   git add .
   git commit -m "feat: simulador osce emergencia e tec-5600"
   git branch -M main
   git remote add origin https://github.com/feralog/simulador-osce.git
   git push -u origin main
   ```
3. No GitHub, abra o repositório e vá em:
   - **Settings** (Configurações)
   - Clique em **Pages** (no menu lateral esquerdo)
   - Em **Build and deployment** > **Source**, selecione:  
     👉 **GitHub Actions**
4. Pronto! O GitHub irá rodar a compilação automaticamente em menos de 1 minuto e fornecerá o link público do seu simulador:
   `https://feralog.github.io/simulador-osce/`

---

### Opção 2: Subir a Pasta Pronta `dist` (Sem precisar de Actions)

Se você preferir apenas gerar a build localmente e subir os arquivos já compilados:

1. Gere a pasta compilada:
   ```bash
   npm run build
   ```
2. A pasta `dist` conterá:
   - `index.html`
   - `assets/...` (CSS e JS embutidos com caminhos relativos)
3. Você pode subir o conteúdo da pasta `dist` direto na branch `gh-pages` ou dentro de uma pasta `/docs` na branch principal, selecionando no GitHub Pages a opção **Deploy from a branch**.

---

## 💻 Como Rodar Localmente no seu Computador

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
3. Abra seu navegador em `http://localhost:3000`.

---

## 🩺 Estrutura dos Casos Clínicos

- **Megacode Evolutivo 1**: Bradicardia Instável (BAVT) ➔ TV Monomórfica sem Pulso ➔ AESP ➔ RCE & Cuidados Pós-Parada (CPPCR).
- **Megacode Evolutivo 2**: Taquicardia Instável (TSV/TV) ➔ Cardioversão Sincronizada com Protocolo OSASCO ➔ Degeneração para Fibrilação Ventricular (FV) ➔ Amiodarona 300 mg e RCE.
- **Caso Focado 1**: BAVT Instável no Idoso & Ajuste Fino do Marca-passo Transcutâneo TEC-5600 (ajuste de ppm, subida da corrente mA até captura e analgesia).
- **Caso Focado 2**: TPSV Estável & Manobra de Valsalva Modificada em 3 tempos + Bolus de Adenosina 6 mg com flush.
- **Caso Focado 3**: Parada em Linha Reta & Protocolo CAGADA (**CA**bos, **GA**nho aumentado, **DA**erivação trocada).
- **Sorteador Aleatório**: Gerador infinito de casos com novas histórias e apresentações clínicas.
