import Map "mo:core/Map";
import List "mo:core/List";
import Nat "mo:core/Nat";

module {
  type OldColumn = {
    id : Nat;
    name : Text;
    projectId : Nat;
    cardIds : List.List<Nat>;
  };

  type OldActor = {
    columns : Map.Map<Nat, OldColumn>;
  };

  type NewColumn = {
    id : Nat;
    name : Text;
    projectId : Nat;
    cardIds : List.List<Nat>;
    isComplete : Bool;
  };

  type NewActor = {
    columns : Map.Map<Nat, NewColumn>;
  };

  public func run(old : OldActor) : NewActor {
    let newColumns = old.columns.map<Nat, OldColumn, NewColumn>(
      func(_id, oldCol) {
        { oldCol with isComplete = false };
      }
    );
    { columns = newColumns };
  };
}
