-- =============================================================================
-- 2026-04-19 Add Gray v Going Places Leisure Travel Ltd [2005] EWCA Civ 189
-- Court of Appeal (Civil Division), Brooke, Latham and Neuberger LJJ, 7 Feb 2005
--
-- SCOPE NOTE: the only relevant issue for the credit-hire case law directory is
-- the promptness principle for third-party cost applications articulated at
-- paragraphs [11] and [15] per Neuberger LJ. The allocation-of-jurisdiction and
-- routes-of-appeal analyses in this judgment are NOT relevant to credit-hire
-- NPCO practice and should be disregarded in that context.
--
-- Shared by Mr Benjamin Williams KC (4 New Square) for use in defending the
-- retrospective NPCO applications currently being pursued by Keoghs LLP on
-- historic credit hire cases after Tescher v DAML; AXA v Spectra
-- [2025] EWCA Civ 733.
--
-- PDF must be uploaded to Supabase Storage bucket `judgments` as
-- Gray v Going Places Leisure Travel Ltd 2005 PNLR 26.pdf
-- for the pdf_url below to resolve.
-- =============================================================================

insert into public.cases (
  id,
  filename,
  case_name,
  citation,
  court,
  court_level,
  date,
  year,
  judges,
  claimant,
  defendant,
  outcome,
  outcome_party,
  summary,
  key_principles,
  legal_topics,
  significance,
  amount_at_stake,
  key_paragraphs,
  cases_cited,
  pdf_url
) values (
  'gray-v-going-places-2005',
  'Gray v Going Places Leisure Travel Ltd 2005 PNLR 26.pdf',
  'Gray v Going Places Leisure Travel Ltd',
  '[2005] EWCA Civ 189, [2005] P.N.L.R. 26',
  'Court of Appeal (Civil Division)',
  2,
  '2005-02-07',
  2005,
  '["Brooke LJ", "Latham LJ", "Neuberger LJ"]'::jsonb,
  'Anita Gray (Respondent on appeal)',
  'Going Places Leisure Travel Ltd (Appellant on appeal)',
  'Appeal dismissed. The Court of Appeal held that the district judge had no jurisdiction to make the wasted costs order because, in the absence of good reason, costs orders (including third-party costs orders) should be dealt with by the trial tribunal immediately after judgment disposing of the case. Although a late application is permissible in principle, the court entertaining such an application is not bound to grant it where there is no good reason for the delay.',
  'claimant',
  'SCOPE: For credit-hire purposes the only relevant issue in this judgment is the principle that costs applications against third parties should generally be made promptly and, in the absence of good reason, should be determined by the trial tribunal. See paragraphs [11] and [15] per Neuberger LJ. Authority shared by Mr Benjamin Williams KC (4 New Square) for use in defending the retrospective NPCO applications currently being pursued by Keoghs LLP against Credit Hire Organisations on historic cases in reliance on Tescher v DAML, AXA v Spectra [2025] EWCA Civ 733. At [11] Neuberger LJ set out three propositions which are of direct application: (1) costs orders in proceedings that go to trial are in principle part of the overall order made at the conclusion of the trial, (2) in the absence of at least a good reason to the contrary, the costs of proceedings should be dealt with by the tribunal which determines the issue that disposes of the case, immediately after the judgment disposing of the case, and (3) "in principle, there is no difference in this connection between a costs order against a party and a costs order against a non-party. They are all part of the judicial function involved in disposing of a case." At [15] Neuberger LJ added: an application for a wasted costs order can be made after the order disposing of the proceedings has been drawn up, "but that is not to say the court entertaining the application late will necessarily grant it if there is no good reason for the delay." Although the judgment is framed in terms of wasted costs, the third proposition at [11] expressly treats party and non-party costs orders as indistinguishable in this respect. Defendant insurers and their solicitors pursuing late NPCO applications on historic credit hire cases must accordingly be prepared to show a good reason for the delay. "Waiting for binding authority" (the explanation now being advanced by Keoghs in reliance on Tescher) is open to challenge on that footing.',
  '[ "[11], proposition 2: in the absence of at least a good reason to the contrary, the costs of proceedings should be dealt with by the tribunal which determines the issue which disposes of the case immediately after the judgment in disposing of the case.", "[11], proposition 3: in principle, there is no difference in this connection between a costs order against a party and a costs order against a non-party. They are all part of the judicial function involved in disposing of a case.", "[15]: the application for a wasted costs order can be made after the order in relation to the proceedings have been drawn up. That is not to say the court entertaining the application late will necessarily grant it if there is no good reason for the delay.", "Practical consequence: a party pursuing a late third-party costs application carries an evidential burden to justify the delay. Mere reliance on subsequent binding authority (e.g. waiting for Tescher/Spectra) is unlikely, of itself, to constitute good reason within the meaning of Gray." ]'::jsonb,
  '[ "non-party costs orders", "NPCO", "wasted costs", "late applications", "promptness", "costs", "third party costs", "delay", "good reason", "retrospective applications", "Tescher follow-on" ]'::jsonb,
  'Binding Court of Appeal authority for the proposition that third-party costs applications should be made promptly and should be determined by the trial tribunal absent good reason. Directly relevant to defending the retrospective NPCO applications currently being pursued by Keoghs LLP against CHOs on historic cases in reliance on Tescher v DAML, AXA v Spectra [2025] EWCA Civ 733. Shared for this purpose by Mr Benjamin Williams KC. SCOPE NOTE: only the promptness principle at [11] and [15] is relevant for credit-hire purposes, the allocation-of-jurisdiction and routes-of-appeal analyses in the judgment are not relevant in the NPCO context and should be disregarded.',
  null,
  '[ "[11]: First, the making of an order as to who should bear the costs and on what basis in respect of proceedings which go to a trial are, in principle, part of the overall order made by the court at the conclusion of the trial... Secondly, in the absence of at least a good reason to the contrary, the costs of proceedings... should be dealt with by the tribunal which determines the issue which disposes of the case immediately after the judgment in disposing of the case. Thirdly, in principle, there is no difference in this connection between a costs order against a party and a costs order against a non-party. They are all part of the judicial function involved in disposing of a case. (Neuberger LJ)", "[15]: Sixthly, it is right to record that the application for a wasted costs order can be made after the order in relation to the proceedings have been drawn up. That is not to say the court entertaining the application late will necessarily grant it if there is no good reason for the delay... it is the court that determines the outcome of the proceedings which has the jurisdiction to make any order for wasted costs, and it is, in the absence of good reason, only that court which has that jurisdiction. (Neuberger LJ)" ]'::jsonb,
  '[ "In re Inchcape [1942] Ch. 394", "Ridehalgh v Horsefield [1994] Ch. 205", "Melchior v Vettivel (unreported, Ch.D., 25 May 2001)", "Aaron v Shelton [2004] EWHC 1162, [2004] 3 All E.R. 561" ]'::jsonb,
  'https://qgxefdfatcvcodjoodyg.supabase.co/storage/v1/object/public/judgments/Gray%20v%20Going%20Places%20Leisure%20Travel%20Ltd%202005%20PNLR%2026.pdf'
)
on conflict (id) do update set
  filename = excluded.filename,
  case_name = excluded.case_name,
  citation = excluded.citation,
  court = excluded.court,
  court_level = excluded.court_level,
  date = excluded.date,
  year = excluded.year,
  judges = excluded.judges,
  claimant = excluded.claimant,
  defendant = excluded.defendant,
  outcome = excluded.outcome,
  outcome_party = excluded.outcome_party,
  summary = excluded.summary,
  key_principles = excluded.key_principles,
  legal_topics = excluded.legal_topics,
  significance = excluded.significance,
  amount_at_stake = excluded.amount_at_stake,
  key_paragraphs = excluded.key_paragraphs,
  cases_cited = excluded.cases_cited,
  pdf_url = excluded.pdf_url,
  updated_at = now();

-- Verify
select id, case_name, court, year, outcome_party
from public.cases
where id = 'gray-v-going-places-2005';
