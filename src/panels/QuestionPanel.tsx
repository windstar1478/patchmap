import { openQuestions } from '../data/setup'

/** SPEC: openQuestions 를 앱 안에 체크리스트로 띄운다. */
export function QuestionPanel() {
  return (
    <div className="panel">
      <h2>미확인 항목</h2>
      <p className="hint">답이 나오면 data.json 을 고치고 해당 항목을 지운다.</p>
      <ul className="questions">
        {openQuestions.map((q) => (
          <li key={q.id}>
            <b>{q.q}</b>
            {q.blocks && <span className="blocks">막는 값: {q.blocks.join(', ')}</span>}
            {q.fallback && <span className="fallback">대안: {q.fallback}</span>}
            {q.contact && <span className="fallback">문의: {q.contact}</span>}
            {q.note && <span className="fallback">{q.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
