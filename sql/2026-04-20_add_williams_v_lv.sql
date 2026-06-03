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
  'williams-v-liverpool-victoria-2023',
  'Williams v Liverpool Victoria Insurance.pdf',
  'Williams v Liverpool Victoria Insurance',
  '(County Court at Cardiff, HHJ Jarman KC, 24 February 2023)',
  'County Court (first instance)',
  4,
  '2023-02-24',
  2023,
  '["HHJ Jarman KC"]'::jsonb,
  'Williams',
  'Liverpool Victoria Insurance',
  'Mixed. Liability admitted. Claimant held to be impecunious and entitled to credit hire rate. '
  'Reasonable hire period found to run until early October 2020 (shortly after D interim payment). '
  'HOWEVER, HHJ Jarman KC dismissed the hire claim under the first two hire agreements (entered '
    'before the IVA) on the basis that they were unenforceable because of the IVA entered by C '
    'on 10 August 2020 and because DAML had not proved the debt in the IVA. '
  'Only the 28 days of hire under the third agreement (entered after the IVA) were allowed, '
    'totalling GBP 13,624.56. '
  'PTA was granted by Nicklin J on the IVA/unenforceability point. '
  'The appeal was settled before the hearing. '
  'The case is therefore not a binding determination on the IVA issue, but its facts, reasoning '
    'and the skeleton arguments prepared by Mr Benjamin Williams KC for the abortive appeal have '
    'become the focal authority for defendants (particularly Keoghs) seeking to deploy an IVA '
    'defence to credit hire recovery.',
  'mixed',
  'The claimant car was badly damaged in an RTA in Cardiff caused by the defendant insured driver. '
  'Liability was admitted. '
  'The car was deemed a total loss. '
  'The claimant could not afford conventional non-credit hire and took a replacement from Direct '
    'Accident Management Ltd (DAML) on credit hire, remaining in hire for 215 days (24 March 2020 '
    'to 24 October 2020) across three separate hire agreements (24 March, 16 June, 2 September 2020). '
  'On 10 August 2020, during the second hire agreement, the claimant entered an Individual '
    'Voluntary Arrangement (IVA) with his creditors. '
  'The CHO was not notified of the IVA proposal, did not vote on it, and was not listed as a creditor. '
  'The IVA supervisor (Katy Walker) was appointed on terms that no assets would vest in her. '
  'Clause 15(1) of the Standard Conditions (2016) confirmed that the debtor remained trustee of '
    'assets in his custody, possession or control. '
  'The IVA specifically envisaged that extant claims could continue to be pursued if the supervisor '
    'agreed. '
  'HHJ Jarman KC found C impecunious and entitled to the full credit rate, found the reasonable '
    'hire period ran until early October 2020 (post D interim payment), and rejected D argument '
    'that C was debarred by breach of a peremptory order from relying on impecuniosity. '
  'He dismissed the claim for hire under the first two agreements on the basis that the IVA '
    'rendered them unenforceable, drawing a (disputed) analogy with Dimond v Lovell [2000] UKHL 27. '
  'He allowed 28 days of hire under the third (post-IVA) agreement at GBP 13,624.56. '
  'PTA was refused on the impecuniosity point by Stacey J and Nicklin J but granted on the '
    'IVA/unenforceability point. '
  'The appeal was settled before hearing.',
  '[ "An IVA is a statutory contract (Insolvency Act 1986, s 260(2)) binding every creditor entitled '
    'to vote, whether or not they had notice. It is not an extinction of debts: Green v Wright [2017] '
    'EWCA Civ 111.", '
  '"HHJ Jarman KC analogy of the IVA with the irremediable CCA unenforceability in Dimond v Lovell '
    '[2000] UKHL 27 is, on the analysis advanced by Mr Benjamin Williams KC for the claimant appeal, '
    'wrong in law: the IVA merely places a moratorium on enforcement by creditors while assets are '
    'collected, and does not permanently reduce the debtor liability to those creditors.", '
  '"The argument that an IVA entered after the first two hire agreements is res inter alios acta as '
    'between the claimant and the tortfeasor is supported by: (a) the collateral-arrangement analysis '
    'in The Elena dAmico [1980] 1 Lloyd Rep 75 and British Westinghouse [1912] AC 673, (b) AssetCo v '
    'Grant Thornton [2019] EWHC 150 (scheme of arrangement is not mitigation), and (c) policy '
    'considerations in Parry v Cleaver [1970] AC 1.", '
  '"Dimond v Lovell does not assist the defendant: the unenforceability there was irremediable CCA '
    'unenforceability that arose out of the mitigating step itself (the hire agreement). An IVA '
    'entered after the hire agreement is a subsequent, collateral composition between C and his '
    'creditors and does not share that character.", '
  '"If an IVA did reduce the tortfeasor liability, creditors would be better off bankrupting the '
    'debtor than entering the IVA. This militates in favour of treating IVA discounts as res inter '
    'alios acta for the purposes of damages.", '
  '"Practical pointers for CHOs: (i) ISAGI report the existence of an IVA in their bank statement '
    'reports and propose to add an IVA indicator to the initial credit check report, (ii) a CHO '
    'faced with this defence should engage specialist leading counsel, (iii) the supervisor '
    'consent to the continuation of extant claims is usually available and should be obtained in '
    'writing." ]'::jsonb,
  '[ "impecuniosity", "IVA", "Individual Voluntary Arrangement", "Insolvency Act 1986", '
    '"section 260 Insolvency Act 1986", "res inter alios acta", "collateral arrangement", '
    '"mitigation", "credit hire rate", "enforceability", "Dimond v Lovell", "Green v Wright", '
    '"AssetCo v Grant Thornton", "Parry v Cleaver", "unsecured creditor", "DAML", "Keoghs", '
    '"Ben Williams KC", "Bond Turner" ]'::jsonb,
  'Focal first-instance authority in the emerging IVA defence to credit hire. '
  'Although the judgment of HHJ Jarman KC is not binding and was the subject of granted-but-settled '
    'permission to appeal, it is routinely relied on by Keoghs LLP (and others) to resist recovery '
    'of credit hire charges where the claimant has entered an IVA. '
  'The claimant skeleton arguments on the abortive appeal (drafted by Mr Benjamin Williams KC) '
    'contain the detailed rebuttal of the IVA defence and are the essential reference point. '
  'See accompanying counsel_article on Impecuniosity and IVAs by Steve Evans (The Credit Hire Forum) '
    'for full analysis.',
  'Total hire c. GBP 92,000 (215 days). Awarded GBP 13,624.56 (28 days under third agreement). '
    'Disallowed GBP 78,300.96 (first two agreements, on IVA grounds).',
  '[ "HHJ Jarman KC: In the absence of any timely application to challenge the IVA, or any '
    'application to extend time for doing so, I should proceed on the basis that the IVA binds '
    'DAML as if it were a party to the arrangement.", '
  '"HHJ Jarman KC (paras 44-45 summarised): Because DAML neither challenged the IVA nor included '
    'its charges within it as a creditor, it is not clear that any amount is payable to it under '
    'the IVA, and therefore the hire charges are unenforceable such that C had suffered no loss in '
    'respect of them (cf Dimond v Lovell).", '
  '"Appellant argument (rejected at first instance but supported by grant of PTA): s 260(2)(b) of '
    'the Insolvency Act 1986 provides that the approved arrangement binds every person who was '
    'entitled to vote as if they were a party, and the IVA does not extinguish the debt - see '
    'Green v Wright [2017] EWCA Civ 111 at paras 21, 27 and 30-33.", '
  '"The IVA supervisor was appointed on terms that no assets would vest in her, and clause 15(1) '
    'of the Standard Conditions (2016) confirmed that the debtor remained the trustee of assets '
    'in his custody. The IVA specifically envisaged that extant claims could continue to be '
    'pursued if the supervisor agreed.", '
  '"The IVA was proposed on the basis of a settlement at 10.63 pence in the pound, but anticipated '
    'a greater settlement (up to 100 pence) depending on the realisation of C assets including the '
    'proceeds of subsequent legal claims." ]'::jsonb,
  '[ "Lagden v OConnor [2004] 1 AC 1067", "Dimond v Lovell [2000] UKHL 27", '
  '"Green v Wright [2017] EWCA Civ 111", '
  '"AssetCo v Grant Thornton [2019] EWHC 150", '
  '"Parry v Cleaver [1970] AC 1", '
  '"Re Wisepark Ltd [1994] BCC 221", '
  '"Re Bradley-Hole [1995] 1 WLR 1097", '
  '"Johnson v Davies [1999] Ch 117", '
  '"Golstein v Bishop [2013] EWHC 1706 (Ch)", '
  '"The Elena dAmico [1980] 1 Lloyd Rep 75", '
  '"British Westinghouse v Underground Electric Railways [1912] AC 673", '
  '"Thai Airways v K I Holdings [2015] EWHC 1250", '
  '"Merrett v Capitol Indemnity [1991] 1 Lloyd Rep 169", '
  '"Freeman v Lockett [2006] EWHC 102", '
  '"Pilkington v Wood [1953] Ch 770", '
  '"English v Emery Reimbold Strick [2002] EWCA Civ 605" ]'::jsonb,
  'https://qgxefdfatcvcodjoodyg.supabase.co/storage/v1/object/public/judgments/Williams%20v%20Liverpool%20Victoria.pdf'
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
where id = 'williams-v-liverpool-victoria-2023';
