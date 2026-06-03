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
  'hartshorn-v-nfu-mutual',
  'Hartshorn v NFU Mutual - DWF Case Comment.pdf',
  'Hartshorn v NFU Mutual Insurance',
  '(County Court at Newcastle, HHJ Freeman on appeal, February 2022)',
  'County Court (Newcastle) - Appeal from District Judge',
  4,
  '2022-02',
  2022,
  '["HHJ Freeman"]'::jsonb,
  'Hartshorn (taxi driver, Newcastle)',
  'NFU Mutual Insurance',
  'Appeal dismissed. '
  'The first-instance award of damages based on loss of profit (GBP 2,716.48) plus fixed overheads '
    '(5 months of car finance at GBP 740.10) plus storage (GBP 1,024) - total GBP 4,480.58 - was upheld. '
  'The claimant did not beat the defendant Part 36 offers (GBP 1,290 for recovery and storage plus '
    'GBP 9,850 for hire) and was subject to the resulting costs consequences. '
  'On appeal, HHJ Freeman upheld the trial judge on two points. '
  'First, occasional SDP use of the taxi was not, on the facts, a Hussain v EUI exception that would '
    'justify hire at c. GBP 30,000. '
  'Second, although the claimant was Lagden-impecunious, the household finances (including his partner '
    'income as a cleaner and Working Tax Credits) could properly be taken into account to conclude that '
    'he did not satisfy the separate Hussain-impecuniosity exception (i.e. the need to work to survive).',
  'defendant',
  'The claimant was a taxi driver in Newcastle whose own vehicle was written off in an accident caused '
    'by an NFU Mutual insured. '
  'He instructed Winns Solicitors and hired a replacement taxi from On Hire (the linked credit hire '
    'company) for 133 days at GBP 29,877.12. '
  'He also incurred recovery and storage charges of GBP 1,344 (largely because correspondence had '
    'initially gone to the wrong insurer). '
  'Taxi BHR in Newcastle could not be obtained. '
  'The defendant instead obtained SDP rates in case the court awarded loss of profit plus an SDP element '
    '(per Hussain v EUI [2019] EWHC 2647 (QB)). '
  'At first instance the judge applied Hussain and awarded only loss of profit (GBP 2,716.48 over 133 '
    'days), fixed overheads (GBP 740.10) and storage (GBP 1,024), totalling GBP 4,480.58. '
  'The claimant failed to beat the defendant Part 36 offers and suffered the costs consequences. '
  'On appeal, HHJ Freeman upheld the trial judge on both limbs. '
  'On the SDP exception, the court held that occasional SDP use is a matter of degree, not binary: '
    'even where some SDP use is established, this does not automatically put the claimant inside one '
    'of the Hussain exceptions. '
  'The trial judge impressionistic assessment that a taxi could be used for the occasional SDP need '
    'was within his discretion. '
  'On the impecuniosity exception, HHJ Freeman distinguished Lagden-impecuniosity (whether a claimant '
    'can afford to hire at spot/BHR rates) from Hussain-impecuniosity (whether the claimant needs to '
    'work to survive). '
  'The Hussain standard is materially lower: the judge is bound to look at the bigger picture, including '
    'household finances and outgoings. '
  'Here the trial judge had considered the claimant net profit of c. GBP 7,000 p.a., his partner income '
    'as a cleaner, and the family Working Tax Credits, and had concluded that the family would cope '
    'without the claimant income while awaiting the PAV payment. '
  'That conclusion was open to him.',
  '[ "HUSSAIN EXCEPTIONS ARE A MATTER OF DEGREE, NOT BINARY. Following Hussain v EUI [2019] EWHC 2647 '
    '(QB), where the cost of hire in a taxi case significantly exceeds loss of profit the court will '
    'ordinarily limit damages to lost profit. The three exceptions (future trading compromised, SDP '
    'use, impecuniosity) are discretionary. Occasional SDP use is insufficient on its own.", '
  '"TWO DIFFERENT IMPECUNIOSITY TESTS. The Lagden impecuniosity test (can a claimant afford to hire at '
    'spot/BHR rates?) is DIFFERENT from the Hussain exception (whether the claimant needed to work to '
    'survive). The Hussain standard is materially lower. A claimant who satisfies Lagden may still '
    'fail Hussain.", '
  '"HOUSEHOLD INCOME IS RELEVANT TO HUSSAIN-IMPECUNIOSITY. The court must look at the bigger picture - '
    'including the spouse/partner income and household outgoings. Judges are bound to look at the '
    'bigger picture and it would be artificial not to take account of other members of the household.", '
  '"THE TRIAL JUDGE IMPRESSIONISTIC ASSESSMENT IS RESPECTED ON APPEAL. Whether a particular level of '
    'SDP use justifies a replacement vehicle is an impressionistic assessment that the trial judge is '
    'uniquely positioned to make.", '
  '"PRACTICAL CONSEQUENCE OF PART 36. The claimant credit hire claim of c. GBP 30,000 over 133 days '
    'was reduced to c. GBP 4,480. Part 36 offers were not beaten, with the costs consequences of CPR '
    'Part 36.17(3) following." ]'::jsonb,
  '[ "taxi credit hire", "loss of profit", "Hussain v EUI", "SDP exception", "impecuniosity", '
    '"Lagden impecuniosity", "Hussain impecuniosity", "household income", "spouse income", '
    '"mitigation", "Part 36", "costs consequences", "credit hire rate", "social and domestic use", '
    '"need for hire", "On Hire", "Winns Solicitors", "DWF", "NFU Mutual" ]'::jsonb,
  'Persuasive first-instance-on-appeal County Court authority on three points of practical importance '
    'in taxi credit hire litigation. '
  '(1) The Hussain SDP exception is a matter of degree: occasional SDP use of a taxi is unlikely on its '
    'own to justify hire at credit hire rates. '
  '(2) The impecuniosity test in Hussain is materially different from, and lower than, the Lagden '
    'impecuniosity test. '
  '(3) Household income (including partner income and benefits such as Working Tax Credits) may be '
    'taken into account when considering whether the claimant needs to work to survive. '
  'Point (3) is genuinely novel and is being deployed by defendant insurers (here DWF, acting for NFU '
    'Mutual). '
  'SCOPE NOTE: source is Gavin Perry (DWF) case comment. Defendant-favourable framing. Persuasive only.',
  'Hire claimed GBP 29,877.12 (133 days), recovery and storage GBP 1,344. Awarded: loss of profit '
    'GBP 2,716.48, fixed overheads GBP 740.10, storage GBP 1,024 = GBP 4,480.58. '
  'Part 36 offers of GBP 1,290 (recovery/storage) and GBP 9,850 (hire) not beaten.',
  '[ "HHJ Freeman (on SDP): whilst there would be an element of inconvenience in using a taxi, this '
    'would not necessarily mean a claimant had made their case for the need to hire another vehicle. '
    'It is an impressionistic assessment that the trial judge is uniquely positioned to make.", '
  '"HHJ Freeman (on household income): judges are bound to look at the bigger picture and what is '
    'needed by a household to discharge its outgoings, and it would be artificial not to take account '
    'of other members of the household. The appeal judge in Hussain had that in mind when he talked '
    'about providing for families.", '
  '"The trial judge (facts on impecuniosity, approved on appeal): the claimant had a declared net '
    'profit of around GBP 7,000 p.a., his partner was a cleaner, the household received Working Tax '
    'Credits. On that basis the family would cope without the claimant income, he was not the main '
    'breadwinner, and he did not need to replace the vehicle before receiving the PAV.", '
  '"Gavin Perry (DWF, acting for NFU Mutual) commentary: There is now a potential argument to defeat '
    'hire charges in a case where a claimant claims to use their taxi for SDP purposes. HHJ Freeman '
    'determined that even where some SDP use is established, this does not automatically put the '
    'claimant into one of the Hussain v EUI exceptions.", '
  '"Gavin Perry (DWF) commentary: It has been successfully argued that impecuniosity as it relates to '
    'credit hire (in a Lagden sense) is materially different to the question of impecuniosity for the '
    'purposes of Hussain. The latter was a fundamentally lower standard." ]'::jsonb,
  '[ "Hussain v EUI [2019] EWHC 2647 (QB)", "Lagden v OConnor [2004] 1 AC 1067" ]'::jsonb,
  'https://qgxefdfatcvcodjoodyg.supabase.co/storage/v1/object/public/knowledge/Hartshorn-v-NFU-DWF-Case-Comment.pdf'
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

select id, case_name, court, year, outcome_party
from public.cases
where id = 'hartshorn-v-nfu-mutual';
