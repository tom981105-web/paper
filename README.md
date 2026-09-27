# 논문 도서관

논문 분석을 개별 JSON 파일로 분리해 관리하는 정적 웹사이트입니다.

## 현재 구조

```text
paper/
├─ index.html
├─ assets/
│  ├─ app.js
│  └─ style.css
├─ data/
│  ├─ index.json
│  ├─ paper-template.json
│  └─ papers/
│     └─ paper-....json
└─ .github/workflows/pages.yml
```

## 반영 방식

- `data/index.json`: 카드 목록에 필요한 메타데이터만 저장
- `data/papers/*.json`: 논문별 전체 분석 내용 저장
- 사이트는 처음에 `index.json`만 읽고, 사용자가 논문을 클릭할 때 해당 개별 JSON만 불러옵니다.

## 자동화 방식

매시간 자동화는 다음 두 작업만 수행하면 됩니다.

1. `data/papers/<고유ID>.json` 새 파일 생성
2. `data/index.json` 배열 맨 앞에 목록용 항목 1개 추가

DOI가 이미 `index.json`에 있으면 중복으로 간주하고 다른 논문을 선택합니다.

## 배포

main 브랜치에 push되면 GitHub Actions가 GitHub Pages로 자동 배포합니다.
