import Map "mo:core/Map";
import List "mo:core/List";
import Nat "mo:core/Nat";

module {
  // Old state does not have filter presets
  type OldActor = {
    projects : Map.Map<Nat, { id : Nat; name : Text }>;
    users : Map.Map<Nat, { id : Nat; name : Text; pinHash : Text; isAdmin : Bool; isMasterAdmin : Bool }>;
    columns : Map.Map<Nat, { id : Nat; name : Text; projectId : Nat; cardIds : List.List<Nat> }>;
    cards : Map.Map<Nat, { id : Nat; title : Text; description : ?Text; columnId : Nat; projectId : Nat; assignedUserId : ?Nat; tags : [Nat]; dueDate : ?Int; createdAt : Int }>;
    tags : Map.Map<Nat, { id : Nat; projectId : Nat; name : Text; color : Text }>;
    revisions : Map.Map<Nat, { id : Nat; actorName : Text; timestamp : Int; revisionType : Text; description : Text; cardId : ?Nat; projectId : Nat }>;
    comments : Map.Map<Nat, { id : Nat; cardId : Nat; authorId : Nat; authorName : Text; text : Text; timestamp : Int }>;
    nextProjectId : Nat;
    nextUserId : Nat;
    nextColumnId : Nat;
    nextCardId : Nat;
    nextTagId : Nat;
    nextRevisionId : Nat;
    nextCommentId : Nat;
  };

  type NewFilterPreset = {
    id : Nat;
    projectId : Nat;
    createdByUserId : Nat;
    name : Text;
    assigneeId : ?Nat;
    tagIds : [Nat];
    unassignedOnly : Bool;
    textSearch : Text;
    dateField : ?Text;
    dateFrom : Text;
    dateTo : Text;
  };

  type NewActor = {
    projects : Map.Map<Nat, { id : Nat; name : Text }>;
    users : Map.Map<Nat, { id : Nat; name : Text; pinHash : Text; isAdmin : Bool; isMasterAdmin : Bool }>;
    columns : Map.Map<Nat, { id : Nat; name : Text; projectId : Nat; cardIds : List.List<Nat> }>;
    cards : Map.Map<Nat, { id : Nat; title : Text; description : ?Text; columnId : Nat; projectId : Nat; assignedUserId : ?Nat; tags : [Nat]; dueDate : ?Int; createdAt : Int }>;
    tags : Map.Map<Nat, { id : Nat; projectId : Nat; name : Text; color : Text }>;
    revisions : Map.Map<Nat, { id : Nat; actorName : Text; timestamp : Int; revisionType : Text; description : Text; cardId : ?Nat; projectId : Nat }>;
    comments : Map.Map<Nat, { id : Nat; cardId : Nat; authorId : Nat; authorName : Text; text : Text; timestamp : Int }>;
    filterPresets : Map.Map<Nat, NewFilterPreset>;
    nextProjectId : Nat;
    nextUserId : Nat;
    nextColumnId : Nat;
    nextCardId : Nat;
    nextTagId : Nat;
    nextRevisionId : Nat;
    nextCommentId : Nat;
    nextFilterPresetId : Nat;
  };

  // Migration function to initialize new filterPresets
  public func run(old : OldActor) : NewActor {
    let filterPresets = Map.empty<Nat, NewFilterPreset>();
    { old with filterPresets; nextFilterPresetId = 1 };
  };
};
