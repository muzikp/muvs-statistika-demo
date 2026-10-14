# Úprava textů webu

Všechny texty používané na webu upravujte v souboru **`src/locales/cs.json`**. Je to běžný JSON v kódování UTF-8, takže můžete psát české znaky přímo.

## Kde co najdete

| Sekce slovníku | Obsah |
| --- | --- |
| `meta` | Popis webu pro vyhledávače |
| `app` | Navigace, úvodní stránka, nadpisy modulů, patička a titulek stránky |
| `simulator` | Nastavení a výsledky simulace intervalů |
| `sampling` | Názvy a vysvětlení metod výběru, validační hlášení |
| `populationLabels` | Názvy věkových skupin, pohlaví, vzdělání a telefonů |
| `help` | Dlouhé nápovědy: každá má `title` a seznam `paragraphs` |
| `tooltip` | Přístupné popisky tlačítek nápovědy a jejich zavírání |
| `forest`, `plot` | Intervalový les a popisky grafů |
| `export` | Sekce Export na webu |
| `xlsx` | Názvy listů, sloupců a vysvětlení v exportovaných sešitech |
| `probability` | Stránka teorie pravděpodobnosti |
| `probabilityRules` | Popisky operací, vzorce a vysvětlení pravděpodobností |
| `hypothesis` | Stránka testování hypotéz, grafy, chyby, validace a export; její nápovědy jsou v `help.hyp…` |
| `statistics` | Hlášení statistických pomocných funkcí |

Klíče, například `pocetLidiVPopulaci`, jsou stálé identifikátory. **Měňte hodnoty vpravo, klíče nepřejmenovávejte ani nemažte.** Název klíče nemusí odpovídat novému znění textu.

## Příklad úpravy

V části `simulator` můžete změnit:

```json
"losujteVzorkySledujteOdhadyIChyby": "Zkoušejte různé výběry a porovnávejte výsledky."
```

U nápovědy lze upravovat nadpis i jednotlivé odstavce, případně přidat další odstavec do seznamu:

```json
"sampleSize": {
  "title": "Kolik lidí bude v jednom vzorku?",
  "paragraphs": [
    "Každý výběr osloví nastavený počet různých lidí.",
    "Větší vzorek obvykle zmenšuje náhodné kolísání."
  ]
}
```

## Proměnné v textech

Některé texty obsahují pojmenované zástupné hodnoty v závorkách. Aplikace je dosazuje automaticky:

```json
"progress": "{completed} / {total} výběrů"
```

Můžete změnit okolní text nebo pořadí proměnných, například na `"Hotovo {completed} výběrů z {total}"`. **Zachovejte názvy proměnných i jejich jednoduché složené závorky.** Čísla, procenta a názvy metod není potřeba doplňovat ručně. Nepřejmenovávejte `{completed}` například na `{hotovo}`.

## Na co dát pozor

- JSON používá dvojité uvozovky. Uvozovku uvnitř věty zapište jako `\"`, nový řádek jako `\n`.
- Za poslední položkou objektu nebo seznamu nesmí být čárka. JSON nepodporuje komentáře.
- Pište běžný text, nikoli HTML. Značky jako `<strong>` se bezpečně zobrazí jako text; vzhled a zvýraznění zůstávají v komponentách.
- U `populationLabels` můžete přejmenovat položky, ale zachovejte jejich počet a pořadí. Jsou to popisky modelových kategorií. Přejmenování věkové skupiny nemění skutečně generovaný věk osob.
- Vzorce v `probabilityRules` slouží k zobrazení. Úpravou textu vzorce se nemění samotný výpočet.
- Cesty stránek, identifikátory metod, výpočty a názvy stahovaných souborů zůstávají v kódu; nejsou to textové popisky.

## Jak změny zobrazit

Při vývoji (`npm run dev`) Vite změnu slovníku načte automaticky; případně obnovte stránku. Už nasazený web vyžaduje nové sestavení a nasazení:

```bash
npm run check
npm run build
```

První příkaz ověří odkazy na klíče. Druhý ověří JSON a vytvoří aktualizovaný web v `dist`. Změna souboru v repozitáři sama o sobě nezmění už publikovanou verzi.

V kódu se pro jednotlivé texty používá typovaná funkce `t('sekce.klic', { proměnná: hodnota })` z `src/lib/texts.ts`. Nápovědy a seznamy popisků se načítají přímo z téhož slovníku; kopie textů se v TypeScriptu neudržují.
