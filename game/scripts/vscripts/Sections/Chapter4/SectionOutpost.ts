import * as tut from "../../Tutorial/Core";
import * as tg from "../../TutorialGraph/index";
import * as shared from "./Shared"
import { RequiredState } from "../../Tutorial/RequiredState";
import { getOrError, getPlayerHero, highlightUiElement, removeHighlight, displayDotaErrorMessage, setUnitPacifist, getPlayerCameraLocation, findRealPlayerID, unitIsValidAndAlive } from "../../util";
import { GoalTracker } from "../../Goals";
import { modifier_abs_no_damage } from "../../modifiers/modifier_abs_no_damage";

const sectionName: SectionName = SectionName.Chapter4_Outpost;

let graph: tg.TutorialStep | undefined = undefined;

const requiredState: RequiredState = {
    requireSlacksGolem: true,
    requireSunsfanGolem: true,
    heroLocation: Vector(-2000, 3800, 256),
    requireRiki: true,
    rikiLocation: Vector(-2200, 3800, 256),
    heroLevel: 6,
    heroAbilityMinLevels: [1, 1, 1, 1],
    heroItems: { "item_greater_crit": 1, "item_mysterious_hat": 1 },
    blockades: Object.values(shared.blockades),
    clearWards: false,
    topDireT1TowerStanding: false,
    topDireT2TowerStanding: false,
};

let canPlayerTakeOutpost = false
let allowUseItem = false;
const dustName = "item_dust";
const dustLocation = Vector(-1000, 4500, 256);
const lastSawRikiLocation = Vector(-1790, 3760);
const rikiName = CustomNpcKeys.Riki;
// UI Highlighting Paths
const inventorySlot1UIPath = "HUDElements/lower_hud/center_with_stats/center_block/inventory/inventory_items/InventoryContainer/inventory_list_container/inventory_list/inventory_slot_1";

function onStart(complete: () => void) {
    print("Starting", sectionName);

    const goalTracker = new GoalTracker();
    const goalPickupDust = goalTracker.addBoolean(LocalizationKey.Goal_4_Outpost_1);
    const goalGoToLastLocationSawRiki = goalTracker.addBoolean(LocalizationKey.Goal_4_Outpost_2);
    const goalUseDust = goalTracker.addBoolean(LocalizationKey.Goal_4_Outpost_3);
    const goalTakeOutpost = goalTracker.addBoolean(LocalizationKey.Goal_4_Outpost_4);
    const goalKillRiki = goalTracker.addBoolean(LocalizationKey.Goal_4_Outpost_5);

    const playerHero = getOrError(getPlayerHero(), "Could not find the player's hero.");

    const direOutpost = getOrError(Entities.FindByName(undefined, "npc_dota_watch_tower_top"));
    if (direOutpost && direOutpost.GetTeamNumber() === DOTATeam_t.DOTA_TEAM_GOODGUYS) direOutpost.SetTeam(DOTATeam_t.DOTA_TEAM_BADGUYS)
    allowUseItem = false;
    canPlayerTakeOutpost = false

    graph = tg.withGoals(_ => goalTracker.getGoals(),
        tg.seq([
            // tg.immediate(_ => shared.blockades.direJungleLowToHighground.destroy()),
            tg.immediate(_ => setUnitPacifist(playerHero, true)),
            // Part 0: Pick up and use dust
            tg.withHighlights(tg.seq([
                tg.immediate(_ => {
                    goalPickupDust.start();
                    CreateItemOnPositionSync(dustLocation, CreateItem(dustName, undefined, undefined));
                }),
                tg.forkAny([
                    tg.seq([
                        tg.audioDialog(LocalizationKey.Script_4_Outpost_1, LocalizationKey.Script_4_Outpost_1, ctx => ctx[CustomNpcKeys.SunsFanMudGolem]),
                        tg.audioDialog(LocalizationKey.Script_4_Outpost_2, LocalizationKey.Script_4_Outpost_2, ctx => ctx[CustomNpcKeys.SunsFanMudGolem]),
                        tg.neverComplete()
                    ]),
                    tg.seq([
                        tg.completeOnCheck(_ => playerHero.HasItemInInventory(dustName), 0.2)
                    ])
                ])
            ]), { type: "arrow", locations: [dustLocation] }),

            tg.immediate(_ => {
                goalPickupDust.complete();
                goalGoToLastLocationSawRiki.start();
            }),

            tg.goToLocation(GetGroundPosition(lastSawRikiLocation, undefined)),
            tg.immediate(_ => playerHero.SetMoveCapability(DOTAUnitMoveCapability_t.DOTA_UNIT_CAP_MOVE_NONE)),
            tg.immediate(_ => {
                goalGoToLastLocationSawRiki.complete();
                goalUseDust.start();
                allowUseItem = true;
                highlightUiElement(inventorySlot1UIPath, undefined, HighlightMouseButton.Left);
            }),

            tg.forkAny([
                tg.seq([
                    tg.audioDialog(LocalizationKey.Script_4_Outpost_3, LocalizationKey.Script_4_Outpost_3, ctx => ctx[CustomNpcKeys.SlacksMudGolem]),
                    tg.neverComplete()
                ]),
                tg.seq([
                    tg.completeOnCheck(_ => !playerHero.HasItemInInventory(dustName), 0.2),
                ])
            ]),
            tg.immediate(_ => {
                goalUseDust.complete();
                removeHighlight(inventorySlot1UIPath);
                setUnitPacifist(playerHero, false);
            }),

            tg.immediate(_ => playerHero.SetMoveCapability(DOTAUnitMoveCapability_t.DOTA_UNIT_CAP_MOVE_GROUND)),

            // Part 1: Find Riki with dust, watch Riki escape
            tg.immediate(context => {
                const riki = getOrError(context[CustomNpcKeys.Riki] as CDOTA_BaseNPC | undefined);
                riki.AddNewModifier(undefined, undefined, modifier_abs_no_damage.name, {})
                const smokeScreen = riki.GetAbilityByIndex(0);
                if (smokeScreen) {
                    riki.CastAbilityOnPosition(playerHero.GetAbsOrigin().__add(Vector(100, 100)), smokeScreen, 0);
                }
            }),
            tg.audioDialog(LocalizationKey.Script_4_RTZ_foundme, LocalizationKey.Script_4_RTZ_foundme, ctx => ctx[rikiName]),
            tg.audioDialog(LocalizationKey.Script_4_Outpost_4, LocalizationKey.Script_4_Outpost_4, ctx => ctx[CustomNpcKeys.SunsFanMudGolem]),

            tg.immediate(context => {
                const riki = getOrError(context[CustomNpcKeys.Riki] as CDOTA_BaseNPC | undefined);
                const lotusOrb = riki.GetItemInSlot(0) as CDOTABaseAbility;
                if (lotusOrb) {
                    riki.CastAbilityOnTarget(riki, lotusOrb, 0);
                }
            }),
            tg.wait(0.5),
            tg.immediate(context => {
                const riki = getOrError(context[CustomNpcKeys.Riki] as CDOTA_BaseNPC | undefined);
                const tricksOfTheTrade = riki.GetAbilityByIndex(2);
                if (tricksOfTheTrade) {
                    riki.CastAbilityOnPosition(riki.GetAbsOrigin().__add(Vector(-200, 100)), tricksOfTheTrade, 0);
                    riki.Purge(false, true, false, false, false); // Purge dust
                }
            }),
            tg.audioDialog(LocalizationKey.Script_4_RTZ_getaway, LocalizationKey.Script_4_RTZ_getaway, ctx => ctx[rikiName], 2.5),
            tg.audioDialog(LocalizationKey.Script_4_Outpost_5, LocalizationKey.Script_4_Outpost_5, ctx => ctx[CustomNpcKeys.SlacksMudGolem]),

            tg.withHighlights(tg.seq([
                tg.panCameraLinear(_ => getPlayerCameraLocation(), direOutpost.GetAbsOrigin(), 2),
                tg.audioDialog(LocalizationKey.Script_4_Outpost_6, LocalizationKey.Script_4_Outpost_6, ctx => ctx[CustomNpcKeys.SunsFanMudGolem]),
                tg.audioDialog(LocalizationKey.Script_4_Outpost_7, LocalizationKey.Script_4_Outpost_7, ctx => ctx[CustomNpcKeys.SlacksMudGolem]),

                // Part 2: Take outpost
                tg.immediate(_ => {
                    goalTakeOutpost.start();
                    canPlayerTakeOutpost = true
                }),

                tg.audioDialog(LocalizationKey.Script_4_Outpost_8, LocalizationKey.Script_4_Outpost_8, ctx => ctx[CustomNpcKeys.SunsFanMudGolem]),

                tg.completeOnCheck(_ => {
                    return direOutpost.GetTeam() === DOTATeam_t.DOTA_TEAM_GOODGUYS;
                }, 1),
            ]), { type: "circle", units: [direOutpost as CDOTA_BaseNPC_Building], radius: 300 }),

            // Part 3: Take down Riki
            tg.immediate(_ => {
                goalTakeOutpost.complete();
                goalKillRiki.start();
            }),

            tg.immediate(context => {
                const riki = getOrError(context[CustomNpcKeys.Riki] as CDOTA_BaseNPC | undefined);
                riki.RemoveModifierByName(modifier_abs_no_damage.name);
                riki.SetAttackCapability(DOTAUnitAttackCapability_t.DOTA_UNIT_CAP_MELEE_ATTACK);
            }),

            tg.forkAny([
                tg.seq([
                    tg.audioDialog(LocalizationKey.Script_4_Outpost_9, LocalizationKey.Script_4_Outpost_9, ctx => ctx[CustomNpcKeys.SlacksMudGolem]),
                    tg.neverComplete()
                ]),
                tg.loop(context => {
                    return unitIsValidAndAlive(context[CustomNpcKeys.Riki])
                },
                    tg.seq([
                        tg.immediate(context => {
                            const riki = getOrError(context[CustomNpcKeys.Riki] as CDOTA_BaseNPC | undefined);
                            if (playerHero.IsAlive())
                                riki.MoveToTargetToAttack(playerHero);
                        }),
                        tg.wait(1)
                    ])
                ),
            ]),

            tg.audioDialog(LocalizationKey.Script_4_RTZ_pain, LocalizationKey.Script_4_RTZ_pain, ctx => ctx[rikiName]),
            tg.audioDialog(LocalizationKey.Script_4_RTZ_death, LocalizationKey.Script_4_RTZ_death, ctx => ctx[rikiName]),
            tg.immediate(_ => goalKillRiki.complete()),
            tg.audioDialog(LocalizationKey.Script_4_Outpost_10, LocalizationKey.Script_4_Outpost_10, ctx => ctx[CustomNpcKeys.SunsFanMudGolem]),
            tg.audioDialog(LocalizationKey.Script_4_Outpost_11, LocalizationKey.Script_4_Outpost_11, ctx => ctx[CustomNpcKeys.SlacksMudGolem]),
        ])
    )

    graph.start(GameRules.Addon.context, () => {
        print("Completed", sectionName);
        complete();
    });
}

function onStop() {
    print("Stopping", sectionName);
    removeHighlight(inventorySlot1UIPath);
    if (graph) {
        graph.stop(GameRules.Addon.context);
        graph = undefined;
    }
}

function orderFilter(event: ExecuteOrderFilterEvent): boolean {
    if (event.issuer_player_id_const !== findRealPlayerID()) return true

    if (event.order_type === dotaunitorder_t.DOTA_UNIT_ORDER_ATTACK_TARGET && event.entindex_target) {
        const target = EntIndexToHScript(event.entindex_target)
        const topOutpost = getOrError(Entities.FindByName(undefined, "npc_dota_watch_tower_top"))
        if (target === topOutpost && !canPlayerTakeOutpost) {
            displayDotaErrorMessage(LocalizationKey.Error_Outpost_1)
            return false
        }
    }

    if (event.order_type === dotaunitorder_t.DOTA_UNIT_ORDER_DROP_ITEM || event.order_type === dotaunitorder_t.DOTA_UNIT_ORDER_MOVE_ITEM) {
        displayDotaErrorMessage(LocalizationKey.Error_Outpost_2)
        return false;
    }
    if (event.order_type === dotaunitorder_t.DOTA_UNIT_ORDER_CAST_NO_TARGET && !allowUseItem) {
        displayDotaErrorMessage(LocalizationKey.Error_Outpost_3)
        return false;
    }
    return true;
}

export const sectionOutpost = new tut.FunctionalSection(
    sectionName,
    requiredState,
    onStart,
    onStop,
    orderFilter,
);
