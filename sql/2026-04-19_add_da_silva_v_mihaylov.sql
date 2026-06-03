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
  'da-silva-v-mihaylov-2024',
  'Da Silva v Mihaylov - Keoghs Case Comment 27-02-2024.pdf',
  'Doglas Da Silva v Martin Mihaylov',
  '(County Court, HHJ Carter, 2024. Reported in case comment by Louise Milford, Keoghs LLP, 27 February 2024)',
  'County Court (multi-track)',
  4,
  '2024-02-27',
  2024,
  '["HHJ Carter"]'::jsonb,
  'Doglas Da Silva (Brazilian food delivery rider, Deliveroo / Uber Eats)',
  'Martin Mihaylov',
  'Claim partially succeeded. Liability was admitted. '
  'The claimant established need for a replacement motorcycle (he used it for work as a delivery rider) but could '
    'not establish impecuniosity. '
  'Of the pleaded 511 days of credit hire at a total of GBP 145,870.08, only 41 days at BHR were awarded (GBP 570). '
  'The claimant was found fundamentally dishonest for knowingly concealing a Brazilian bank account on the '
    'impecuniosity disclosure. '
  'Section 57 CJCA 2015 was NOT engaged because the PSLA claim was not itself dishonest. '
  'However QOCS protection was lost, the claimant was ordered to pay 75 per cent of the defendant costs on the '
    'indemnity basis, '
  'and there was no order for costs in the claimant favour. '
  'The damages award was offset against an interim payment on account of the defendant costs, resulting in nil net '
    'recovery for the claimant.',
  'defendant',
  'A food delivery rider on a Honda motorcycle was struck by a Volkswagen driven by the defendant. Liability was admitted. '
  'The claimant sought the PAV of the motorcycle (c. '
  'GBP 1,400), PSLA, a helmet, recovery and storage charges, and credit hire from Direct Accident Management Ltd '
    '(DAML) of GBP 145,870.08 over 511 days. '
  'Impecuniosity was pleaded and standard impecuniosity directions were made. '
  'The case was originally on the fast track but the initial trial was adjourned for insufficient hearing time and '
    'reallocated to the multi-track for two days. '
  'At trial, counsel conceded that the period from mid-May 2022 to late November 2022 was not recoverable because '
    'the claimant solicitors had gone to sleep on the '
  'file. In cross-examination the claimant accepted that he had a Brazilian bank account into which money had been '
    'transferred using the Remitly app, '
  'that the Brazilian account and the Remitly account had not been disclosed, and that he had elected to disclose '
    'only his UK bank accounts. '
  'A mid-trial application for relief from sanctions and an extension of time to produce the Brazilian statements '
    'was refused. '
  'HHJ Carter found the claimant was wholly inconsistent, that the Brazilian account had been knowingly concealed, '
  'that the claimant was an unconvincing witness and that his evidence should be treated with considerable caution. '
    'On need, the claimant succeeded. '
  'On period, he was entitled to 41 days at BHR (GBP 570). '
  'On fundamental dishonesty, HHJ Carter held the defendant had shown on the balance of probabilities that the '
    'claimant was fundamentally dishonest in relation to '
  'the impecuniosity element, which was substantial and was the reason the claim had been reallocated to the multi-track. '
  'The judge observed that it was hard to envisage a clearer case of dishonesty being fundamental to a claim. '
  'Section 57 was not engaged because the PSLA limb was not itself dishonest, but QOCS protection was disapplied and '
    'the costs consequences followed. '
  'Reported in Keoghs own case comment of 27 February 2024 by Louise Milford, Complex Credit Hire team.',
  '[ "Financial disclosure for impecuniosity must be genuinely full and frank. A claimant with a Brazilian (or other '
    'foreign) bank account and a Remitly/transfer account who discloses only UK accounts risks a finding of '
    'fundamental dishonesty even if need and a modest BHR period are otherwise made out.", '
  '"A finding of fundamental dishonesty can be confined to one limb of the claim (here the impecuniosity/credit hire '
    'limb) without engaging section 57 CJCA 2015, so long as the court is not satisfied that the PSLA limb is itself '
    'dishonest. But QOCS protection is still lost on the whole claim.", '
  '"The costs consequences of a fundamental-dishonesty finding confined to the hire claim can still be severe: here, '
    '75 per cent of the defendant costs on the indemnity basis, no order for costs in the claimant favour, and damages '
    'offset against the interim costs order so that nil net damages were recovered.", '
  '"Mid-trial applications for relief from sanctions to produce absent disclosure of foreign-account material are '
    'unlikely to succeed where the absence has not been properly explained.", '
  '"Forensic line-by-line scrutiny of impecuniosity disclosure is a practical imperative for defendant insurers, '
    'especially where the claimant has connections to a non-UK banking system. Month-end balances alone do not show '
    'the true financial picture." ]'::jsonb,
  '[ "fundamental dishonesty", '
  '"section 57 CJCA 2015", '
  '"QOCS", '
  '"impecuniosity", '
  '"impecuniosity disclosure", '
  '"financial disclosure", '
  '"foreign bank accounts", '
  '"Remitly", '
  '"need for hire", '
  '"basic hire rate", '
  '"credit hire rate", '
  '"delivery rider", '
  '"motorcycle hire", '
  '"indemnity costs", '
  '"costs consequences of dishonesty", '
  '"Direct Accident Management", '
  '"DAML", '
  '"Keoghs", '
  '"Bond Turner", '
  '"multi-track", '
  '"reallocation" ]'::jsonb,
  'A County Court decision of HHJ Carter, unreported save for Keoghs own case comment of 27 February 2024. '
  'Although not binding, the decision is frequently cited by defendant insurers in support of (a) forensic scrutiny '
    'of foreign-account impecuniosity disclosure, '
  '(b) the proposition that fundamental dishonesty can be confined to the credit hire/impecuniosity limb without '
    'engaging section 57, '
  'and (c) the severity of costs consequences in such cases. '
  'It is also a cautionary illustration for claimant solicitors of the risk of going to sleep on the file during a '
    'long hire period. '
  'Users searching for this case may sometimes mis-remember the claimant name - common aliases include Da Silva, Dasilva, '
  'De Silva and Mesquita - all of which should return this entry.',
  'Credit hire claim GBP 145,870.08 (511 days), awarded GBP 570 (41 days at BHR). Total claim included PSLA, PAV and '
    'associated losses.',
  '[ "HHJ Carter: hard to envisage a clearer case of dishonesty being fundamental to a claim.", '
  '"HHJ Carter: the claimant was wholly inconsistent in his evidence about the Brazilian bank account. There was no '
    'explanation as to why this account had not formed part of his disclosure.", '
  '"HHJ Carter: the claimant knowingly concealed his Brazilian account.", '
  '"HHJ Carter: the claimant responses to difficult questions were lacking in credibility and overall he was an '
    'unconvincing witness. The court would treat his evidence with a considerable degree of caution.", '
  '"On need: the claimant needed a replacement motorbike to work as a delivery driver. He was entitled to hire a '
    'replacement bike until he was in a position to replace it from his own funds (not being impecunious). This was '
    'assessed at 41 days, being the date the vehicle was scrapped.", '
  '"On fundamental dishonesty: the defendant had shown on the balance of probabilities that the claimant was '
    'dishonest, that his dishonesty was fundamental to the claim and had had a substantial effect on the presentation '
    'of the claim. The impecuniosity element of the hire claim was not only substantial but was the reason the claim '
    'came out of the fast track and into the multi-track.", '
  '"On section 57: because the PSLA claim was not itself found to be dishonest, a section 57 defence was not engaged.", '
  '"On costs: QOCS protection was lost. The claimant was to pay 75 per cent of the defendant costs of the claim on '
    'the indemnity basis. There was no order for costs in the claimant favour despite his obtaining a judgment. The '
    'damages were offset against an interim on account of the defendant costs, resulting in no payment to the '
    'claimant." ]'::jsonb,
  '[]'::jsonb,
  'https://qgxefdfatcvcodjoodyg.supabase.co/storage/v1/object/public/judgments/Da%20Silva%20v%20Mihaylov%20Keoghs%20Ar'
    'ticle.pdf'
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
where id = 'da-silva-v-mihaylov-2024';
