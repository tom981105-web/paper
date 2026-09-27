# 논문 도서관

논문 분석을 `data/papers.json`에서 읽어 자동으로 표시하는 정적 웹사이트입니다.

## 구조

```text
paper/
├─ index.html
├─ assets/
│  ├─ app.js
│  └─ style.css
├─ data/
│  ├─ papers.json
│  └─ paper-template.json
└─ .github/workflows/pages.yml
```

## 논문 반영 방식

사이트 UI 코드는 건드리지 않고 `data/papers.json`만 갱신하면 새 논문 카드가 자동으로 표시됩니다.

향후 자동화는 매시간 생성된 논문 JSON을 기존 `papers.json` 배열에 합쳐 GitHub에 커밋하는 방식으로 연결합니다.

## 배포

main 브랜치에 push되면 GitHub Actions가 GitHub Pages로 자동 배포하도록 구성했습니다.

배포 트리거 확인용으로 초기 구성을 완료했습니다.
