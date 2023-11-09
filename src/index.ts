import { $query, $update, Record, StableBTreeMap, Vec, match, Result, nat64, ic, Opt, Principal } from 'azle';
import { v4 as uuidv4 } from 'uuid';

type Medicine = Record<{
  creator: Principal;
  id: string;
  title: string;
  description: string;
  created_date: nat64;
  updated_at: Opt<nat64>;
  expiry_date: string;
  assigned_to: string;
  tags: Vec<string>;
  status: string;
  priority: string; // Added for Medicine Priority
  comments: Vec<string>; // Added for Medicine Comments
}>;
type MedicinePayload = Record<{
  title: string;
  description: string;
  assigned_to: string;
  expiry_date: string;
}>;

const MedicineStorage = new StableBTreeMap<string, Medicine>(0, 44, 512);

// Number of Medicines to load initially
const initialLoadSize = 4;

// Load the Initial batch of Medicines
$query
export function getInitialMedicines(): Result<Vec<Medicine>, string> {
  try {
    const initialMedicines = MedicineStorage.values().slice(0, initialLoadSize);
    if (initialMedicines.length === 0) {
      return Result.Err("No initial medicines found");
    }
    return Result.Ok(initialMedicines);
  } catch (error) {
    return Result.Err("Failed to fetch initial medicines");
  }
}

// Load more Medicines as the user scrolls down
$query
export function loadMoreMedicines(offset: number, limit: number): Result<Vec<Medicine>, string> {
  if (offset < 0 || limit < 0 || !Number.isInteger(offset) || !Number.isInteger(limit)) {
    return Result.Err("Invalid input parameters");
  }

  const allMedicines = MedicineStorage.values();
  if (allMedicines.length === 0) {
    return Result.Err("No more medicines to load");
  }

  if (offset >= allMedicines.length) {
    return Result.Err("Invalid offset");
  }

  const totalMedicines = allMedicines.length;
  if (offset + limit > totalMedicines) {
    return Result.Err("Invalid offset and limit");
  }

  const moreMedicines = allMedicines.slice(offset, offset + limit);
  return Result.Ok(moreMedicines);
}

// Loading a Specific mdicine
$query
export function getMedicine(id: string): Result<Medicine, string> {
  if (!id) {
    return Result.Err<Medicine, string>('Invalid id parameter');
  }

  return match(MedicineStorage.get(id), {
    Some: (medicine) => {
      if (medicine.creator.toString() !== ic.caller().toString()) {
        return Result.Err<Medicine, string>('You are not authorized to access Medicine');
      }
      return Result.Ok<Medicine, string>(medicine);
    },
    None: () => Result.Err<Medicine, string>(`Medicine with id:${id} not found`),
  });
}

// Get Medicine available by Tags
$query
export function getMedicineByTags(tag: string): Result<Vec<Medicine>, string> {
  const relatedMedicine = MedicineStorage.values().filter((Medicine) => Medicine.tags.includes(tag));
  return Result.Ok(relatedMedicine);
}

// Search Medicine
$query
export function searchMedicines(searchInput: string): Result<Vec<Medicine>, string> {
  const lowerCaseSearchInput = searchInput.toLowerCase();
  try {
    const searchedMedicine = MedicineStorage.values().filter(
      (Medicine) =>
        Medicine.title.toLowerCase().includes(lowerCaseSearchInput) ||
        Medicine.description.toLowerCase().includes(lowerCaseSearchInput)
    );
    return Result.Ok(searchedMedicine);
  } catch (err) {
    return Result.Err('Error finding the Medicine');
  }
}

// Allows Assigned user to approve having completed Medicine
$update
export function completedMedicine(id: string): Result<Medicine, string> {
  return match(MedicineStorage.get(id), {
    Some: (Medicine) => {
      if (!Medicine.assigned_to) {
        return Result.Err<Medicine, string>('No one was assigned the Medicine');
      }
      const completeMedicine: Medicine = { ...Medicine, status: 'Completed' };
      MedicineStorage.insert(Medicine.id, completeMedicine);
      return Result.Ok<Medicine, string>(completeMedicine);
    },
    None: () => Result.Err<Medicine, string>(`Medicine with id:${id} not found`),
  });
}

// Allows a group/Organisation to add a Medicine
$update
export function addMedicine(payload: MedicinePayload): Result<Medicine, string> {
  // Validate input data
  if (!payload.title || !payload.description || !payload.assigned_to || !payload.expiry_date) {
    return Result.Err<Medicine, string>('Missing or invalid input data');
  }

  // Validate expiry date
  const currentDate = new Date();
  const expiryDate = new Date(payload.expiry_date);
  if (expiryDate < currentDate) {
    return Result.Err<Medicine, string>('Expiry date cannot be in the past');
  }

  try {
    const newMedicine: Medicine = {
      creator: ic.caller(),
      id: uuidv4(),
      created_date: ic.time(),
      updated_at: Opt.None,
      tags: [],
      status: 'In Progress',
      priority: "",
      comments: [],
      title: payload.title,
      description: payload.description,
      assigned_to: payload.assigned_to,
      expiry_date: payload.expiry_date

    };
    const insertResult = MedicineStorage.insert(newMedicine.id, newMedicine);
    if (insertResult === undefined) {
      return Result.Err<Medicine, string>('Failed to insert medicine into storage');
    }
    return Result.Ok<Medicine, string>(newMedicine);
  } catch (err) {
    return Result.Err<Medicine, string>('Issue encountered when Creating Medicine');
  }
}

// Adding Tags to the Medicine created
$update
export function addTags(id: string, tags: Vec<string>): Result<Medicine, string> {
  // Validate input data
  if (!tags || tags.length === 0) {
    return Result.Err<Medicine, string>('Invalid tags');
  }

  return match(MedicineStorage.get(id), {
    Some: (Medicine) => {
      if (Medicine.creator.toString() !== ic.caller().toString()) {
        return Result.Err<Medicine, string>('You are not authorized to access Medicine');
      }
      const updatedMedicine: Medicine = { ...Medicine, tags: [...Medicine.tags, ...tags], updated_at: Opt.Some(ic.time()) };
      MedicineStorage.insert(Medicine.id, updatedMedicine);
      return Result.Ok<Medicine, string>(updatedMedicine);
    },
    None: () => Result.Err<Medicine, string>(`Medicine with id:${id} not found`),
  });
}

// Giving capability for the creator to be able to Modify Medicine
$update
export function updateMedicine(id: string, payload: MedicinePayload): Result<Medicine, string> {
  return match(MedicineStorage.get(id), {
    Some: (Medicine) => {
      // Authorization Check
      if (Medicine.creator.toString() !== ic.caller().toString()) {
        return Result.Err<Medicine, string>('You are not authorized to access Medicine');
      }
      const updatedMedicine: Medicine = { ...Medicine, ...payload, updated_at: Opt.Some(ic.time()) };
      MedicineStorage.insert(Medicine.id, updatedMedicine);
      return Result.Ok<Medicine, string>(updatedMedicine);
    },
    None: () => Result.Err<Medicine, string>(`Medicine with id:${id} not found`),
  });
}

// Creator can Delete a Medicine
$update
export function deleteMedicine(id: string): Result<Medicine, string> {
  return match(MedicineStorage.get(id), {
    Some: (Medicine) => {
      // Authorization Check
      if (Medicine.creator.toString() !== ic.caller().toString()) {
        return Result.Err<Medicine, string>('You are not authorized to access Medicine');
      }
      MedicineStorage.remove(id);
      return Result.Ok<Medicine, string>(Medicine);
    },
    None: () => Result.Err<Medicine, string>(`Medicine with id:${id} not found, could not be deleted`),
  });
}

// Assign a Medicine to a User
$update
export function assignMedicine(id: string, assignedTo: string): Result<Medicine, string> {
  return match(MedicineStorage.get(id), {
    Some: (Medicine) => {
      if (Medicine.creator.toString() !== ic.caller().toString()) {
        return Result.Err<Medicine, string>('You are not authorized to assign a Medicine');
      }
      const updatedMedicine: Medicine = { ...Medicine, assigned_to: assignedTo };
      MedicineStorage.insert(Medicine.id, updatedMedicine);
      return Result.Ok<Medicine, string>(updatedMedicine);
    },
    None: () => Result.Err<Medicine, string>(`Medicine with id:${id} not found`),
  });
}

//Change Medicine Status
$update
export function changeMedicineStatus(id: string, newStatus: string): Result<Medicine, string> {
  return match(MedicineStorage.get(id), {
    Some: (Medicine) => {
      if (Medicine.creator.toString() !== ic.caller().toString()) {
        return Result.Err<Medicine, string>('You are not authorized to change the Medicine status');
      }
      const updatedMedicine: Medicine = { ...Medicine, status: newStatus };
      MedicineStorage.insert(Medicine.id, updatedMedicine);
      return Result.Ok<Medicine, string>(updatedMedicine);
    },
    None: () => Result.Err<Medicine, string>(`Medicine with id:${id} not found`),
  });
}

// Get Medicines by Status
$query
export function getMedicinesByStatus(status: string): Result<Vec<Medicine>, string> {
  const MedicinesByStatus = MedicineStorage.values().filter((Medicine) => Medicine.status === status);
  return Result.Ok(MedicinesByStatus);
}

// Set Medicine Priority
$update
export function setMedicinePriority(id: string, priority: string): Result<Medicine, string> {
  return match(MedicineStorage.get(id), {
    Some: (Medicine) => {
      if (Medicine.creator.toString() !== ic.caller().toString()) {
        return Result.Err<Medicine, string>('You are not authorized to set Medicine priority');
      }
      const updatedMedicine: Medicine = { ...Medicine, priority };
      MedicineStorage.insert(Medicine.id, updatedMedicine);
      return Result.Ok<Medicine, string>(updatedMedicine);
    },
    None: () => Result.Err<Medicine, string>(`Medicine with id:${id} not found`),
  });
}

// Medicine Due Date Reminder
$update
export function sendDueDateReminder(id: string): Result<string, string> {
  const now = new Date().toISOString();
  return match(MedicineStorage.get(id), {
    Some: (Medicine) => {
      if (Medicine.expiry_date < now && Medicine.status !== 'Completed') {
        return Result.Ok<string, string>('Medicine is overdue. Please complete it.');
      } else {
        return Result.Err<string, string>('Medicine is not overdue or already completed.');
      }
    },
    None: () => Result.Err<string, string>(`Medicine with id:${id} not found`),
  });
}

//Get Medicines by Creator
$query
export function getMedicinesByCreator(creator: Principal): Result<Vec<Medicine>, string> {
  try {
    const creatorMedicines = MedicineStorage.values().filter((Medicine) => Medicine.creator.toString() === creator.toString());
    return Result.Ok(creatorMedicines);
  } catch (error) {
    return Result.Err(`An error occurred: ${error}`);
  }
}

//Get Overdue Medicines
$query
export function getOverdueMedicines(): Result<Vec<Medicine>, string> {
  try {
    const now = new Date().toISOString();
    const overdueMedicines = MedicineStorage.values().filter(
      (Medicine) => Medicine.expiry_date < now && Medicine.status !== 'Completed'
    );
    return Result.Ok(overdueMedicines);
  } catch (error) {
    return Result.Err('An error occurred while getting overdue medicines.');
  }
}

// Medicine Comments
$update
export function addMedicineComment(id: string, comment: string): Result<Medicine, string> {
  if (!id || comment === null) {
    return Result.Err<Medicine, string>(`invalid id:${id} or comment`);
  }

  return match(MedicineStorage.get(id), {
    Some: (Medicine) => {
      const updatedComments = [...Medicine.comments, comment];
      const updatedMedicine: Medicine = { ...Medicine, comments: updatedComments };
      MedicineStorage.insert(Medicine.id, updatedMedicine);
      return Result.Ok<Medicine, string>(updatedMedicine);
    },
    None: () => Result.Err<Medicine, string>(`Medicine with id:${id} not found`),
  });
}

// UUID workaround
globalThis.crypto = {
  // @ts-ignore
  getRandomValues: () => {
    let array = new Uint8Array(32);

    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }

    return array;
  },
};
