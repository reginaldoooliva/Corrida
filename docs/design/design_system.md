---
name: "Passo Ritmo"
description: "Design system atlético, dinâmico e focado em alta performance para corredores de rua e preparação de provas."
---

## Overview

Passo Ritmo é a identidade para um aplicativo moderno de corredores de rua focado no ciclo completo do atleta amador e competitivo: treinos diários, planilhas semanais, metas de pace e contagem regressiva para provas-alvo (5k, 10k, 21k e maratonas).

A direção visual combina a precisão técnica do cronômetro de rua com a energia vibrante de marcas esportivas contemporâneas. Inspirado no equilíbrio entre o minimalismo suíço funcional e a energia de performance (alta legibilidade, contraste estrito, superfícies escuras técnicas e toques de laranja volt neon para velocidade e ação).

- **Público:** Corredores de rua iniciantes a maratonistas que buscam acompanhar sua evolução, cumprir planilhas e bater recordes pessoais (RP).
- **Tom & Estilo:** Energético, disciplinado, encorajador e baseado em dados claros. Sem excesso de elementos decorativos; a informação de ritmo, distância e contagem regressiva é protagonista.

## Colors

A paleta baseia-se em um fundo moderno de alta legibilidade, com um laranja elétrico volt (`#FF5722`) como cor primária de impulso e corrida, complementado por um turquesa de precisão (`#0D9488`) para métricas de pace e zona de treino, e neutros profundos para clareza em qualquer condição de luminosidade.

- **Primary:** Laranja volt atlético para ações principais, destaques de provas e botões de largada.
- **Secondary:** Turquesa / ciano de precisão técnica para zonas de treino, métricas de frequência e pace.
- **Surface & Neutrals:** Tons escuros esportivos e contrastantes para evitar cansaço visual e destacar números com nitidez.

```yaml
colors:
  volt: "#FF5722"
  pace-teal: "#0D9488"
  success: "#16A34A"
  warning: "#D97706"
  error: "#DC2626"
  light:
    primary: "#D84315"
    on-primary: "#080808"
    primary-container: "#FFEDE8"
    on-primary-container: "#4E1202"
    secondary: "#0F766E"
    on-secondary: "#FFFFFF"
    secondary-container: "#CCFBF1"
    on-secondary-container: "#115E59"
    surface: "#F8FAFC"
    on-surface: "#0F172A"
    surface-variant: "#EDF2F7"
    on-surface-variant: "#475569"
    outline: "#CBD5E1"
    outline-variant: "#E2E8F0"
  dark:
    primary: "#FF6E40"
    on-primary: "#3E1100"
    primary-container: "#5F1B00"
    on-primary-container: "#FFDBCD"
    secondary: "#14B8A6"
    on-secondary: "#003731"
    secondary-container: "#005047"
    on-secondary-container: "#99F6E4"
    surface: "#090D14"
    on-surface: "#F1F5F9"
    surface-variant: "#161F30"
    on-surface-variant: "#94A3B8"
    outline: "#334155"
    outline-variant: "#1E293B"
```

## Typography

Utilizamos **Lexend** para títulos e display pela sua geometria aberta pensada para leitura rápida e dinâmica, **Instrument Sans** para o corpo de texto funcional garantindo precisão anatômica, e **M PLUS 1 Code** para números de cronômetro, splits, pace (min/km) e frequências cardíacas.

```yaml
typography:
  display-lg:
    fontFamily: "Lexend"
    fontSize: 40px
    fontWeight: 800
    lineHeight: 48px
    letterSpacing: -1px
  display-lg-mobile:
    fontFamily: "Lexend"
    fontSize: 32px
    fontWeight: 800
    lineHeight: 38px
    letterSpacing: -0.75px
  display-md:
    fontFamily: "Lexend"
    fontSize: 34px
    fontWeight: 700
    lineHeight: 42px
    letterSpacing: -0.5px
  display-md-mobile:
    fontFamily: "Lexend"
    fontSize: 28px
    fontWeight: 700
    lineHeight: 34px
    letterSpacing: -0.5px
  headline-lg:
    fontFamily: "Lexend"
    fontSize: 28px
    fontWeight: 700
    lineHeight: 36px
    letterSpacing: -0.5px
  headline-lg-mobile:
    fontFamily: "Lexend"
    fontSize: 24px
    fontWeight: 700
    lineHeight: 30px
    letterSpacing: -0.25px
  headline-md:
    fontFamily: "Lexend"
    fontSize: 22px
    fontWeight: 600
    lineHeight: 28px
    letterSpacing: -0.2px
  headline-sm:
    fontFamily: "Lexend"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 24px
    letterSpacing: 0px
  body-lg:
    fontFamily: "Instrument Sans"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
    letterSpacing: 0px
  body-md:
    fontFamily: "Instrument Sans"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: 0px
  body-sm:
    fontFamily: "Instrument Sans"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
    letterSpacing: 0px
  label-lg:
    fontFamily: "Instrument Sans"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 20px
    letterSpacing: 0.1px
  label-md:
    fontFamily: "Instrument Sans"
    fontSize: 12px
    fontWeight: 600
    lineHeight: 16px
    letterSpacing: 0.2px
  label-sm:
    fontFamily: "Instrument Sans"
    fontSize: 10px
    fontWeight: 700
    lineHeight: 14px
    letterSpacing: 0.4px
  metric-display:
    fontFamily: "M PLUS 1 Code"
    fontSize: 32px
    fontWeight: 700
    lineHeight: 36px
    letterSpacing: -0.5px
  metric-md:
    fontFamily: "M PLUS 1 Code"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 26px
    letterSpacing: 0px
  metric-sm:
    fontFamily: "M PLUS 1 Code"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 18px
    letterSpacing: 0px
```

## Layout & Spacing

A aplicação móvel adota uma grade fluida vertical com padding lateral padrão de 16px a 20px, permitindo áreas de toque confortáveis (mínimo 44x44px) para corredores com mãos em movimento.

```yaml
spacing:
  gutter-xs: 4px
  gutter-sm: 8px
  gutter-md: 12px
  gutter-lg: 16px
  gutter-xl: 24px
  gutter-2xl: 32px
  section: 24px
  page-margin: 16px
```

## Elevation & Depth

Utilizamos camadas tonais de superfícies elevadas (`surface-variant`, `surface-container`) com bordas suaves (`outline-variant`) e sombras ambientais difusas. Não há efeitos de vidro excessivos que prejudiquem o contraste sob a luz solar direta da rua.

## Shapes

Bordas arredondadas moderadas transmitem dinamismo e ergonomia esportiva. Badges e chips utilizam curvatura completa estilo pílula.

```yaml
rounded:
  sm: 6px
  DEFAULT: 12px
  md: 14px
  lg: 18px
  xl: 24px
  full: 9999px
```

## Motion & Micro-interaction

As transições são ágeis e energéticas, refletindo cadência de passada e feedback instantâneo de cronometragem e conclusão de treino.

```yaml
motion:
  state-change:
    duration: 120ms
    delay: 0ms
    timingFunction: ease-out
  surface-enter:
    duration: 220ms
    delay: 0ms
    timingFunction: cubic-bezier(0.16, 1, 0.3, 1)
  surface-exit:
    duration: 150ms
    delay: 0ms
    timingFunction: cubic-bezier(0.4, 0, 1, 1)
```

## Voice & Content Strategy

A linguagem é técnica porém motivadora, no vocabulário genuíno dos corredores de rua brasileiros:
- **Termos utilizados:** Pace (min/km), RP (Recorde Pessoal), Longão, Tiro / Intervalado, Rodagem, Altimetria, Fita de chegada, Sub-45, Sub-4h.
- **Ações claras:** "Registrar Prova", "Iniciar Rodagem", "Ver Planilha da Semana", "Concluir Treino".
- **Sem jargões vazios:** Clareza imediata sobre quilometragem, tempo projetado e dias restantes até a prova.

## Components

Component implementations live as individual HTML sticker sheet files in
`components/`. Each file contains the canonical, styled HTML components with
`<!-- COMPONENT: name -->` comment markers. Read each file before use.

- **Button** → `@components/button.html`: `button-primary`, `button-icon`, `button-with-icon`
- **Card** → `@components/card.html`: `card-elevated`, `card-action`, `card-interactive`, `card-interactive-2`
- **Chip** → `@components/chip.html`: `chip-action`, `chip-input`, `chip-with-icon`
- **Tabs** → `@components/tabs.html`: `tabs-horizontal`, `tabs-with-icon`
