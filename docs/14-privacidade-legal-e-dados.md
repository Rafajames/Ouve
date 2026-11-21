# 14 — Privacidade, consentimento e governança de dados

## 1. Padrão do produto
Sem conta obrigatória, sem backend próprio, sem histórico permanente e sem telemetria de conteúdo no MVP. Processamento temporário e exportação controlada pelo usuário.

## 2. Aviso antes da captura
Informar que o Ouve poderá captar áudio e/ou imagem da fonte selecionada. O usuário deve confirmar que tem autorização para capturar e tratar aquele conteúdo e observar legislação, regras institucionais, sigilo e políticas da plataforma. O aplicativo não determina se a gravação é legal.

## 3. Envio a terceiros
Antes do primeiro envio a cada provedor, informar:
- dados enviados;
- finalidade;
- fornecedor/modelo;
- possível custo;
- links para política/termos oficiais;
- retenção/uso para treinamento apenas quando confirmado em fonte oficial.

## 4. Minimização
Enviar áudio/transcrição e quadros estritamente necessários. Evitar vídeo contínuo quando quadros amostrados forem suficientes. Nunca enviar screenshot de tela inteira se a análise puder usar uma janela/aba recortada. Não persistir mídia bruta por padrão.

## 5. Dados sensíveis
Reuniões e audiências podem conter dados pessoais, dados sensíveis, segredos profissionais e informações sigilosas. Alertar o usuário, minimizar coleta e não incluir conteúdo em logs, crash reports ou analytics.

## 6. Direitos e responsabilidades
Antes de distribuição, obter revisão jurídica da política de privacidade, termos de uso, avisos de captura e adequação à LGPD e às regras de cada plataforma. Documentar controlador/operadores conforme o modelo real. Não apresentar este documento como parecer jurídico.

## 7. Incidentes
Definir processo de resposta a vulnerabilidades, dependências comprometidas, exposição de chave e falha de descarte. Como o MVP não tem backend, ainda assim proteger atualização, cadeia de dependências, instalador e credenciais locais.
